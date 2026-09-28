import type { Sql } from "./db.ts";
import { sendOrderConfirmation } from "./order-email.ts";
import { findOrder, markOrderFailed, markOrderPaid, type StoredOrder } from "./orders.ts";
import { normalizeOrderReference } from "./order-reference.ts";
import { claimWhopPayment, markWhopPaymentEmailed } from "./whop-payments.ts";
import type { WhopPaymentNotice } from "./whop-webhook.ts";

export type FulfillmentResult = {
  status: number;
  body: { received: true; outcome: string };
};

type FulfillmentDeps = {
  sql?: Sql | null;
  sendConfirmation?: (order: StoredOrder) => Promise<void>;
};

/**
 * `payment.succeeded` marks the order paid and sends the confirmation email
 * once per Whop payment id. `payment.failed` marks a still-unpaid order failed.
 * A repeated delivery of the same payment id does not send a second email.
 */
export async function fulfillWhopPayment(
  notice: WhopPaymentNotice,
  deps: FulfillmentDeps = {},
): Promise<FulfillmentResult> {
  const reference = normalizeOrderReference(notice.orderId);
  if (!reference) {
    return { status: 200, body: { received: true, outcome: "ignored" } };
  }

  const sql = deps.sql;
  const order = await findOrder(reference, sql);
  if (!order) {
    return { status: 500, body: { received: true, outcome: "order_missing" } };
  }

  if (notice.type === "payment.failed") {
    const claim = await claimWhopPayment(notice.paymentId, "failed", reference, sql);
    if (claim.state === "complete") {
      return { status: 200, body: { received: true, outcome: "duplicate" } };
    }
    await markOrderFailed(reference, sql);
    await markWhopPaymentEmailed(notice.paymentId, "failed", sql);
    return { status: 200, body: { received: true, outcome: "failed" } };
  }

  const claim = await claimWhopPayment(notice.paymentId, "succeeded", reference, sql);
  if (claim.state === "complete") {
    return { status: 200, body: { received: true, outcome: "duplicate" } };
  }

  const paid = await markOrderPaid(reference, sql);
  if (!paid) {
    return { status: 500, body: { received: true, outcome: "not_updated" } };
  }

  const send = deps.sendConfirmation ?? ((current) => sendOrderConfirmation(current));
  try {
    await send(paid);
  } catch (error) {
    console.error("[whop] confirmation email failed", {
      reference,
      paymentId: notice.paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { status: 500, body: { received: true, outcome: "email_failed" } };
  }

  await markWhopPaymentEmailed(notice.paymentId, "succeeded", sql);
  return { status: 200, body: { received: true, outcome: "paid" } };
}
