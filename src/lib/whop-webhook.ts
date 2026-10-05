import "server-only";

import type { Sql } from "@/lib/db";
import { normalizeOrderReference } from "@/lib/order-reference";
import {
  findOrder,
  recordWhopPaymentFailed,
  recordWhopPaymentSucceeded,
  type StoredOrder,
} from "@/lib/orders";
import {
  whopAmountMatches,
  whopOrderId,
  whopPaymentId,
  type WhopWebhookEvent,
} from "@/lib/whop";

export type WhopWebhookOutcome =
  | { outcome: "ignored" }
  | { outcome: "missing" }
  | { outcome: "mismatch"; reference: string }
  | { outcome: "paid"; order: StoredOrder; emailed: boolean }
  | { outcome: "failed"; order: StoredOrder };

/**
 * `payment.succeeded` marks the order paid and asks the caller to send the
 * confirmation email once. `payment.failed` marks a still-pending order failed.
 * The Whop payment id is the idempotency key: a repeat event does not email again.
 */
export async function handleWhopWebhookEvent(
  event: WhopWebhookEvent,
  options: {
    sql: Sql;
    deliver: (order: StoredOrder) => Promise<void>;
  },
): Promise<WhopWebhookOutcome> {
  if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
    return { outcome: "ignored" };
  }

  const reference = whopOrderId(event.data);
  const paymentId = whopPaymentId(event.data);
  if (!normalizeOrderReference(reference) || !paymentId) return { outcome: "ignored" };

  const existing = await findOrder(reference, options.sql);
  if (!existing) return { outcome: "missing" };

  if (event.type === "payment.failed") {
    if (existing.status === "paid" || existing.whopPaymentId === paymentId) {
      return { outcome: "ignored" };
    }
    const failed = await recordWhopPaymentFailed(reference, paymentId, options.sql);
    if (!failed.transitioned || !failed.order) return { outcome: "ignored" };
    return { outcome: "failed", order: failed.order };
  }

  if (existing.status === "paid") return { outcome: "ignored" };
  if (!whopAmountMatches(event.data, existing.totalCents)) {
    return { outcome: "mismatch", reference: existing.reference };
  }

  const paid = await recordWhopPaymentSucceeded(reference, paymentId, options.sql);
  if (!paid.transitioned || !paid.order) return { outcome: "ignored" };

  let emailed = false;
  try {
    await options.deliver(paid.order);
    emailed = true;
  } catch (error) {
    console.error("[whop] confirmation email failed", {
      reference: paid.order.reference,
      paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
  return { outcome: "paid", order: paid.order, emailed };
}
