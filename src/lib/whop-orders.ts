import {
  claimWhopPayment,
  findOrder,
  markCardOrderFailed,
  markCardOrderPaid,
  type StoredOrder,
} from "./orders.ts";
import type { Sql } from "./db.ts";
import { paymentAmountMatches, type WhopPaymentNotice } from "./whop.ts";

export type WhopApplyResult =
  | { action: "paid"; order: StoredOrder }
  | { action: "failed"; order: StoredOrder }
  | { action: "duplicate" }
  | { action: "ignored" };

/**
 * Idempotent on the Whop payment id. A repeated success does not send another
 * email. A failure never downgrades an order that this payment already paid.
 * The charged amount must match the server total before an order is marked paid.
 */
export async function applyWhopPaymentNotice(
  notice: WhopPaymentNotice,
  sql: Sql,
): Promise<WhopApplyResult> {
  const order = await findOrder(notice.orderId, sql);
  if (!order || order.paymentMethod !== "card") return { action: "ignored" };

  if (notice.type === "payment.succeeded") {
    if (order.status === "paid" && order.whopPaymentId === notice.paymentId) {
      return { action: "duplicate" };
    }
    if (!paymentAmountMatches(notice, order.totalCents)) {
      await claimWhopPayment(notice.paymentId, order.reference, "rejected", sql);
      return { action: "ignored" };
    }
    const claim = await claimWhopPayment(notice.paymentId, order.reference, "paid", sql);
    if (claim === "duplicate") return { action: "duplicate" };
    const updated = await markCardOrderPaid(order.reference, notice.paymentId, sql);
    if (!updated) return { action: "duplicate" };
    return { action: "paid", order: updated };
  }

  if (order.status === "paid") return { action: "ignored" };
  const claim = await claimWhopPayment(notice.paymentId, order.reference, "failed", sql);
  if (claim === "duplicate") return { action: "duplicate" };
  const updated = await markCardOrderFailed(order.reference, sql);
  if (!updated) return { action: "duplicate" };
  return { action: "failed", order: updated };
}
