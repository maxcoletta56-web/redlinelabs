import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";

export const WHOP_PAYMENT_OUTCOMES = ["succeeded", "failed"] as const;

export type WhopPaymentOutcome = (typeof WHOP_PAYMENT_OUTCOMES)[number];

/** One row per Whop payment id and outcome. A repeat delivery inserts nothing. */
export const CREATE_WHOP_PAYMENT_EVENTS = `CREATE TABLE IF NOT EXISTS whop_payment_events (
  payment_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reference TEXT NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_id, outcome)
)`;

const CLAIM_EVENT =
  "INSERT INTO whop_payment_events (payment_id, outcome, reference) " +
  "VALUES ($1, $2, $3) " +
  "ON CONFLICT (payment_id, outcome) DO NOTHING " +
  "RETURNING payment_id";

const EVENT_STATE =
  "SELECT email_sent FROM whop_payment_events WHERE payment_id = $1 AND outcome = $2";

const MARK_EMAIL_SENT =
  "UPDATE whop_payment_events SET email_sent = true " +
  "WHERE payment_id = $1 AND outcome = $2 AND email_sent = false " +
  "RETURNING payment_id";

export function ensureWhopPaymentEvents(sql: Sql) {
  return ensureTable(sql, "whop_payment_events", CREATE_WHOP_PAYMENT_EVENTS);
}

export type PaymentClaim =
  | { state: "new" }
  | { state: "email_pending" }
  | { state: "complete" };

/**
 * The first delivery of a payment id is `new`. A retry before the confirmation
 * email is recorded is `email_pending`, so the handler sends again. A retry
 * after that is `complete` and does no further work.
 */
export async function claimWhopPayment(
  paymentId: string,
  outcome: WhopPaymentOutcome,
  reference: string,
  sql: Sql | null = getSql(),
): Promise<PaymentClaim> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  await ensureWhopPaymentEvents(sql);
  const inserted = await sql.query(CLAIM_EVENT, [paymentId, outcome, reference]);
  if (rowsOf(inserted).length > 0) return { state: "new" };
  const existing = await sql.query(EVENT_STATE, [paymentId, outcome]);
  const row = rowsOf(existing)[0] as { email_sent?: boolean } | undefined;
  if (!row) return { state: "new" };
  return row.email_sent ? { state: "complete" } : { state: "email_pending" };
}

/** Records that the confirmation email for this payment has been sent. */
export async function markWhopPaymentEmailed(
  paymentId: string,
  outcome: WhopPaymentOutcome,
  sql: Sql | null = getSql(),
): Promise<boolean> {
  if (!sql) throw new Error("DATABASE_URL is not set");
  await ensureWhopPaymentEvents(sql);
  const result = await sql.query(MARK_EMAIL_SENT, [paymentId, outcome]);
  return rowsOf(result).length > 0;
}
