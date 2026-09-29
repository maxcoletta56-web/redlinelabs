import "server-only";

import { getSql, type Sql } from "@/lib/db";
import {
  claimWhopPayment,
  findOrder,
  markCardOrderFailed,
  markCardOrderPaid,
  releaseWhopPayment,
  type StoredOrder,
} from "@/lib/orders";
import { normalizeOrderReference } from "@/lib/order-reference";
import type { WhopPaymentNotice } from "@/lib/whop";

export type WhopApplyResult = {
  reference: string | null;
  /** True only the first time this payment id moves the order to paid. */
  email: boolean;
  order: StoredOrder | null;
  outcome: "paid" | "failed" | "duplicate" | "ignored";
};

/**
 * Applies one Whop payment event. The payment id is claimed first, so a second
 * delivery of the same id does not send another email or flip the status again.
 * A later, different payment id can still move a failed order to paid.
 */
export async function applyWhopPaymentEvent(
  event: WhopPaymentNotice,
  sql: Sql | null = getSql(),
): Promise<WhopApplyResult> {
  const reference = normalizeOrderReference(event.orderId);
  if (!reference || !sql) return { reference, email: false, order: null, outcome: "ignored" };

  const claimed = await claimWhopPayment(event.paymentId, reference, event.type === "payment.succeeded" ? "succeeded" : "failed", sql);
  if (!claimed) return { reference, email: false, order: null, outcome: "duplicate" };

  try {
    if (event.type === "payment.succeeded") {
      const order = await markCardOrderPaid(reference, sql);
      if (!order) return { reference, email: false, order: await findOrder(reference, sql), outcome: "ignored" };
      return { reference, email: true, order, outcome: "paid" };
    }
    const order = await markCardOrderFailed(reference, sql);
    if (!order) return { reference, email: false, order: await findOrder(reference, sql), outcome: "ignored" };
    return { reference, email: false, order, outcome: "failed" };
  } catch (error) {
    await releaseWhopPayment(event.paymentId, sql).catch(() => undefined);
    throw error;
  }
}
