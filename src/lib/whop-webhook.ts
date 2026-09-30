import { sendPaymentReceivedEmail } from "@/lib/mailer";
import {
  findOrder,
  markCardOrderFailed,
  markCardOrderPaid,
  type StoredOrder,
} from "@/lib/orders";
import { readWhopPaymentEvent } from "@/lib/whop";
import type { Sql } from "@/lib/db";

export type WhopWebhookOutcome =
  | { outcome: "paid"; reference: string }
  | { outcome: "failed"; reference: string }
  | { outcome: "duplicate" | "ignored" | "missing" | "amount_mismatch" | "unhandled"; reference: string | null };

export type HandleWhopWebhookOptions = {
  sql?: Sql | null;
  deliver?: (order: StoredOrder) => Promise<void>;
};

function samePayment(order: StoredOrder, paymentId: string) {
  return order.whopPaymentId === paymentId;
}

/**
 * payment.succeeded marks the card order paid and sends one confirmation.
 * payment.failed marks a still-pending card order failed.
 * A repeated Whop payment id does not send another email or change a paid order.
 */
export async function handleWhopWebhook(
  event: unknown,
  options: HandleWhopWebhookOptions = {},
): Promise<WhopWebhookOutcome> {
  const payment = readWhopPaymentEvent(event);
  if (!payment) return { outcome: "unhandled", reference: null };

  const sql = options.sql;
  const order = await findOrder(payment.orderReference, sql);
  if (!order) return { outcome: "missing", reference: null };
  if (order.paymentMethod !== "card") return { outcome: "ignored", reference: order.reference };

  if (payment.type === "payment.succeeded") {
    if (order.status === "paid" && samePayment(order, payment.paymentId)) {
      return { outcome: "duplicate", reference: order.reference };
    }
    if (order.status === "paid") {
      return { outcome: "ignored", reference: order.reference };
    }
    if (payment.currency !== "aud" || payment.amountCents !== order.totalCents) {
      console.error("[whop] payment amount did not match the order", {
        reference: order.reference,
        paymentId: payment.paymentId,
        currency: payment.currency || "missing",
        amountMatched: false,
      });
      return { outcome: "amount_mismatch", reference: order.reference };
    }
    const paid = await markCardOrderPaid(order.reference, payment.paymentId, sql);
    if (!paid) {
      const current = await findOrder(order.reference, sql);
      if (current?.status === "paid" && samePayment(current, payment.paymentId)) {
        return { outcome: "duplicate", reference: order.reference };
      }
      return { outcome: "ignored", reference: order.reference };
    }
    const deliver =
      options.deliver ??
      ((confirmed: StoredOrder) =>
        sendPaymentReceivedEmail({
          reference: confirmed.reference,
          firstName: confirmed.firstName,
          email: confirmed.email,
          totalCents: confirmed.totalCents,
        }));
    if (options.deliver) {
      await deliver(paid);
    } else {
      const { scheduleEmail } = await import("@/lib/schedule-email");
      scheduleEmail(paid.reference, () => deliver(paid));
    }
    return { outcome: "paid", reference: paid.reference };
  }

  if (order.status === "paid") {
    return { outcome: "ignored", reference: order.reference };
  }
  if (order.status === "failed" && samePayment(order, payment.paymentId)) {
    return { outcome: "duplicate", reference: order.reference };
  }
  const failed = await markCardOrderFailed(order.reference, payment.paymentId, sql);
  if (!failed) {
    return { outcome: "ignored", reference: order.reference };
  }
  return { outcome: "failed", reference: failed.reference };
}
