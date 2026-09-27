import { getSql, type Sql } from "./db.ts";
import { findOrder, markOrderFailed, markOrderPaid, type StoredOrder } from "./orders.ts";
import { claimWhopPayment, releaseWhopPayment } from "./whop-payments.ts";

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string | null;
};

export type WhopWebhookResult = { status: number; body: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Pulls the order reference off the metadata attached when the checkout was created. */
export function readWhopPaymentNotice(event: unknown): WhopPaymentNotice | null {
  const record = asRecord(event);
  const type = readText(record?.type);
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const data = asRecord(record?.data);
  const paymentId = readText(data?.id);
  if (!paymentId) return null;
  const metadata = asRecord(data?.metadata);
  const orderId = readText(metadata?.orderId) || readText(metadata?.order_id) || null;
  return { type, paymentId, orderId };
}

async function sendPaidEmail(
  order: StoredOrder,
  paymentId: string,
  sql: Sql,
  sendConfirmation: (order: StoredOrder) => Promise<void>,
): Promise<WhopWebhookResult> {
  try {
    await markOrderPaid(order.reference, sql);
    await sendConfirmation(order);
    return { status: 200, body: "ok" };
  } catch (error) {
    await releaseWhopPayment(sql, paymentId).catch(() => undefined);
    console.error("[whop-webhook] paid order was not confirmed", {
      reference: order.reference,
      paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { status: 500, body: "retry" };
  }
}

/**
 * Applies one verified payment event. The Whop payment id is claimed before
 * the email is sent, so a retry does not send a second receipt. A failed
 * email releases the claim and returns 500 so Whop retries.
 */
export async function applyWhopPayment(
  notice: WhopPaymentNotice,
  deps: {
    sql?: Sql | null;
    sendConfirmation: (order: StoredOrder) => Promise<void>;
  },
): Promise<WhopWebhookResult> {
  if (!notice.orderId) {
    console.error("[whop-webhook] payment missing orderId", { paymentId: notice.paymentId, type: notice.type });
    return { status: 200, body: "ignored" };
  }

  const sql = deps.sql === undefined ? getSql() : deps.sql;
  if (!sql) return { status: 500, body: "retry" };

  const order = await findOrder(notice.orderId, sql);
  if (!order) {
    console.error("[whop-webhook] payment order was not found", {
      paymentId: notice.paymentId,
      orderId: notice.orderId,
    });
    return { status: 200, body: "ignored" };
  }

  if (notice.type === "payment.failed") {
    const claim = await claimWhopPayment(sql, notice.paymentId, order.reference, "failed");
    if (claim === "duplicate") return { status: 200, body: "ok" };
    await markOrderFailed(order.reference, sql);
    return { status: 200, body: "ok" };
  }

  const claim = await claimWhopPayment(sql, notice.paymentId, order.reference, "paid");
  if (claim === "duplicate") return { status: 200, body: "ok" };
  return sendPaidEmail(order, notice.paymentId, sql, deps.sendConfirmation);
}
