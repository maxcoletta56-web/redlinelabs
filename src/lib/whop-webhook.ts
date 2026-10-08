import "server-only";

import type { Sql } from "./db.ts";
import {
  applyWhopPayment,
  findOrder,
  isWhopPaymentId,
  type StoredOrder,
} from "./orders.ts";
import { normalizeOrderReference } from "./order-reference.ts";
import {
  whopOrderIdFromMetadata,
  whopPaymentAmountCents,
  type WhopWebhookEvent,
} from "./whop.ts";

export type WhopWebhookHooks = {
  sql?: Sql | null;
  findOrder?: (reference: string) => Promise<StoredOrder | null>;
  applyWhopPayment?: typeof applyWhopPayment;
  scheduleEmail?: (reference: string, task: () => Promise<void>) => void;
  sendPaymentReceivedEmail?: (notice: {
    reference: string;
    firstName: string;
    email: string;
    totalCents: number;
  }) => Promise<void>;
};

export type WhopWebhookOutcome = {
  ok: boolean;
  status: number;
  action: "paid" | "failed" | "duplicate" | "ignored" | "error";
};

function currencyOf(data: Record<string, unknown>) {
  return typeof data.currency === "string" ? data.currency.trim().toLowerCase() : "";
}

async function sendReceipt(order: StoredOrder, hooks: WhopWebhookHooks) {
  try {
    const deps =
      hooks.scheduleEmail && hooks.sendPaymentReceivedEmail
        ? {
            scheduleEmail: hooks.scheduleEmail,
            sendPaymentReceivedEmail: hooks.sendPaymentReceivedEmail,
          }
        : await Promise.all([import("./schedule-email.ts"), import("./mailer.ts")]).then(
            ([schedule, mailer]) => ({
              scheduleEmail: schedule.scheduleEmail,
              sendPaymentReceivedEmail: mailer.sendPaymentReceivedEmail,
            }),
          );
    deps.scheduleEmail(order.reference, () =>
      deps.sendPaymentReceivedEmail({
        reference: order.reference,
        firstName: order.firstName,
        email: order.email,
        totalCents: order.totalCents,
      }),
    );
  } catch (error) {
    console.error("[mailer] order email failed", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * `payment.succeeded` marks the metadata order paid and sends the confirmation
 * email. `payment.failed` marks it failed. The Whop payment id is applied once.
 */
export async function handleWhopWebhookEvent(
  event: WhopWebhookEvent,
  hooks: WhopWebhookHooks = {},
): Promise<WhopWebhookOutcome> {
  if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
    return { ok: true, status: 200, action: "ignored" };
  }

  const paymentId = typeof event.data.id === "string" ? event.data.id : "";
  const reference = normalizeOrderReference(whopOrderIdFromMetadata(event.data));
  if (!isWhopPaymentId(paymentId) || !reference) {
    console.error("[whop] webhook missing payment id or orderId", { type: event.type });
    return { ok: true, status: 200, action: "ignored" };
  }

  const lookup = hooks.findOrder ?? ((id: string) => findOrder(id, hooks.sql));
  const existing = await lookup(reference);
  if (!existing) return { ok: false, status: 500, action: "error" };
  if (existing.paymentMethod !== "whop") {
    return { ok: true, status: 200, action: "ignored" };
  }

  const amountCents = whopPaymentAmountCents(event.data);
  const currency = currencyOf(event.data);
  if (currency !== "aud" || amountCents !== existing.totalCents) {
    console.error("[whop] webhook amount did not match the stored order", {
      reference,
      currency: currency || "missing",
    });
    return { ok: true, status: 200, action: "ignored" };
  }

  const apply = hooks.applyWhopPayment ?? ((input) => applyWhopPayment(input, hooks.sql));
  const nextStatus = event.type === "payment.succeeded" ? "paid" : "failed";
  const result = await apply({ reference, paymentId, nextStatus });
  if (result.outcome === "updated" && result.order.status === "paid") {
    await sendReceipt(result.order, hooks);
    return { ok: true, status: 200, action: "paid" };
  }
  if (result.outcome === "updated") return { ok: true, status: 200, action: "failed" };
  if (result.outcome === "duplicate") return { ok: true, status: 200, action: "duplicate" };
  return { ok: true, status: 200, action: "ignored" };
}
