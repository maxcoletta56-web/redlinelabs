import type { Sql } from "./db.ts";
import { ensureTable, getSql, rowsOf } from "./db.ts";
import { normalizeOrderReference } from "./order-reference.ts";
import {
  findOrder,
  markOrderFailed,
  markOrderPaidWithPaymentEmail,
  type MarkPaidEmailHooks,
  type StoredOrder,
} from "./orders.ts";
import type { WhopPaymentEvent } from "./whop.ts";

/** One row per Whop payment id. A repeat delivery of that id does no more work. */
export const CREATE_WHOP_PAYMENTS = `CREATE TABLE IF NOT EXISTS whop_payments (
  payment_id TEXT PRIMARY KEY,
  reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

const CLAIM_PAYMENT =
  "INSERT INTO whop_payments (payment_id, reference, outcome) VALUES ($1, $2, $3) " +
  "ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id";

const RELEASE_PAYMENT = "DELETE FROM whop_payments WHERE payment_id = $1";

export type WhopFulfillmentDeps = {
  sql?: Sql | null;
  findOrder?: (reference: string) => Promise<StoredOrder | null>;
  markOrderFailed?: (reference: string) => Promise<StoredOrder | null>;
  markOrderPaidWithPaymentEmail?: (
    reference: string,
    hooks?: MarkPaidEmailHooks,
  ) => Promise<StoredOrder | null>;
};

export type WhopFulfillmentResult =
  | { outcome: "duplicate" }
  | { outcome: "ignored" }
  | { outcome: "paid"; order: StoredOrder }
  | { outcome: "failed"; order: StoredOrder }
  | { outcome: "already_paid"; order: StoredOrder };

async function claimPayment(sql: Sql, paymentId: string, reference: string, outcome: string) {
  await ensureTable(sql, "whop_payments", CREATE_WHOP_PAYMENTS);
  const result = await sql.query(CLAIM_PAYMENT, [paymentId, reference, outcome]);
  return rowsOf(result).length > 0;
}

async function releasePayment(sql: Sql, paymentId: string) {
  await sql.query(RELEASE_PAYMENT, [paymentId]);
}

/**
 * Applies one signed payment event. The Whop payment id is claimed first so a
 * redelivery cannot send a second confirmation email or flip the status twice.
 * A failure after the claim releases it so Whop's retry can finish the work.
 */
export async function fulfillWhopPayment(
  event: WhopPaymentEvent,
  deps: WhopFulfillmentDeps = {},
): Promise<WhopFulfillmentResult> {
  const reference = normalizeOrderReference(event.orderId);
  if (!reference) return { outcome: "ignored" };

  const sql = deps.sql === undefined ? getSql() : deps.sql;
  if (!sql) throw new Error("Orders are unavailable until the database is configured");

  const claimed = await claimPayment(sql, event.paymentId, reference, event.type);
  if (!claimed) return { outcome: "duplicate" };

  try {
    const lookup = deps.findOrder ?? ((id: string) => findOrder(id, sql));
    const existing = await lookup(reference);
    if (!existing) {
      await releasePayment(sql, event.paymentId);
      throw new Error("Order was not found for this payment");
    }

    if (event.type === "payment.failed") {
      if (existing.status === "paid") return { outcome: "already_paid", order: existing };
      const markFailed = deps.markOrderFailed ?? ((id: string) => markOrderFailed(id, sql));
      const order = await markFailed(reference);
      if (!order) {
        await releasePayment(sql, event.paymentId);
        throw new Error("Order could not be marked failed");
      }
      return { outcome: "failed", order };
    }

    if (existing.status === "paid") return { outcome: "already_paid", order: existing };
    const markPaid =
      deps.markOrderPaidWithPaymentEmail ??
      ((id: string, hooks?: MarkPaidEmailHooks) => markOrderPaidWithPaymentEmail(id, hooks));
    const order = await markPaid(reference);
    if (!order || order.status !== "paid") {
      await releasePayment(sql, event.paymentId);
      throw new Error("Order could not be marked paid");
    }
    return { outcome: "paid", order };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Order")) throw error;
    await releasePayment(sql, event.paymentId).catch(() => undefined);
    throw error;
  }
}
