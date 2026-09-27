import { ensureTable, rowsOf, type Sql } from "./db.ts";

/** Matches db/whop_payments.sql. Neon rejects a trailing semicolon on this endpoint. */
export const CREATE_WHOP_PAYMENTS = `CREATE TABLE IF NOT EXISTS whop_payments (
  payment_id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export type WhopPaymentOutcome = "paid" | "failed";

export type WhopPaymentClaim = "claimed" | "duplicate" | "upgraded";

const INSERT_PAYMENT =
  "INSERT INTO whop_payments (payment_id, order_reference, outcome) VALUES ($1, $2, $3) " +
  "ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id";

const SELECT_OUTCOME = "SELECT outcome FROM whop_payments WHERE payment_id = $1";

const UPGRADE_OUTCOME =
  "UPDATE whop_payments SET outcome = 'paid' WHERE payment_id = $1 AND outcome = 'failed' RETURNING payment_id";

const DELETE_PAYMENT = "DELETE FROM whop_payments WHERE payment_id = $1";

export function ensureWhopPaymentsTable(sql: Sql) {
  return ensureTable(sql, "whop_payments", CREATE_WHOP_PAYMENTS);
}

/**
 * Idempotency key is the Whop payment id. The first delivery claims it. A
 * repeat of the same outcome is a duplicate. A later `payment.succeeded` for
 * a payment already recorded as failed is upgraded so the order can be paid
 * and the confirmation email sent once. A failure never downgrades a payment
 * already recorded as paid.
 */
export async function claimWhopPayment(
  sql: Sql,
  paymentId: string,
  orderReference: string,
  outcome: WhopPaymentOutcome,
): Promise<WhopPaymentClaim> {
  await ensureWhopPaymentsTable(sql);
  const inserted = await sql.query(INSERT_PAYMENT, [paymentId, orderReference, outcome]);
  if (rowsOf(inserted).length > 0) return "claimed";

  if (outcome === "paid") {
    const upgraded = await sql.query(UPGRADE_OUTCOME, [paymentId]);
    if (rowsOf(upgraded).length > 0) return "upgraded";
  }

  const existing = await sql.query(SELECT_OUTCOME, [paymentId]);
  const row = rowsOf(existing)[0] as { outcome?: unknown } | undefined;
  if (row?.outcome === outcome) return "duplicate";
  return "duplicate";
}

/** Drops a claim when the confirmation email failed, so Whop's retry can send it. */
export async function releaseWhopPayment(sql: Sql, paymentId: string) {
  await ensureWhopPaymentsTable(sql);
  await sql.query(DELETE_PAYMENT, [paymentId]);
}
