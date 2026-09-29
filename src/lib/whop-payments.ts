import { ensureTable, rowsOf, type Sql } from "./db.ts";
import { findOrder, markOrderFailed, markOrderPaid, type StoredOrder } from "./orders.ts";

/** Matches db/whop_payments.sql. Neon rejects a trailing semicolon on this endpoint. */
export const CREATE_WHOP_PAYMENTS = `CREATE TABLE IF NOT EXISTS whop_payments (
  payment_id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

const INSERT_PAYMENT =
  "INSERT INTO whop_payments (payment_id, order_reference, outcome, email_sent) " +
  "VALUES ($1, $2, $3, false) " +
  "ON CONFLICT (payment_id) DO NOTHING " +
  "RETURNING payment_id, order_reference, outcome, email_sent";

const SELECT_PAYMENT =
  "SELECT payment_id, order_reference, outcome, email_sent FROM whop_payments WHERE payment_id = $1";

const UPGRADE_FAILED_PAYMENT =
  "UPDATE whop_payments SET outcome = 'paid', email_sent = false " +
  "WHERE payment_id = $1 AND outcome = 'failed' " +
  "RETURNING payment_id";

const CLAIM_EMAIL =
  "UPDATE whop_payments SET email_sent = true " +
  "WHERE payment_id = $1 AND outcome = 'paid' AND email_sent = false " +
  "RETURNING payment_id";

const RELEASE_EMAIL = "UPDATE whop_payments SET email_sent = false WHERE payment_id = $1";

export type WhopOutcome = "paid" | "failed";

export type ConfirmationResult = "sent" | "unconfigured" | "failed";

type PaymentRow = {
  paymentId: string;
  reference: string;
  outcome: WhopOutcome;
  emailSent: boolean;
};

function readPayment(value: unknown): PaymentRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const paymentId = typeof record.payment_id === "string" ? record.payment_id : "";
  const reference = typeof record.order_reference === "string" ? record.order_reference : "";
  const outcome = record.outcome === "paid" || record.outcome === "failed" ? record.outcome : null;
  if (!paymentId || !reference || !outcome) return null;
  return {
    paymentId,
    reference,
    outcome,
    emailSent: record.email_sent === true,
  };
}

export function ensureWhopPaymentsTable(sql: Sql) {
  return ensureTable(sql, "whop_payments", CREATE_WHOP_PAYMENTS);
}

async function loadPayment(sql: Sql, paymentId: string) {
  const result = await sql.query(SELECT_PAYMENT, [paymentId]);
  return readPayment(rowsOf(result)[0]);
}

/**
 * First write for a Whop payment id wins. A later success can upgrade a
 * recorded failure for that same id. A failure never downgrades a success,
 * and the confirmation email is claimed by a single row update.
 */
export async function fulfillWhopPayment(
  input: {
    sql: Sql;
    paymentId: string;
    reference: string;
    outcome: WhopOutcome;
    sendConfirmation: (order: StoredOrder) => Promise<ConfirmationResult>;
  },
): Promise<{ status: 200 | 500 }> {
  await ensureWhopPaymentsTable(input.sql);
  const inserted = readPayment(
    rowsOf(
      await input.sql.query(INSERT_PAYMENT, [input.paymentId, input.reference, input.outcome]),
    )[0],
  );
  let row = inserted;
  if (!row) {
    row = await loadPayment(input.sql, input.paymentId);
    if (!row || row.reference !== input.reference) return { status: 200 };
    if (row.outcome === "paid" && input.outcome === "failed") return { status: 200 };
    if (row.outcome === "failed" && input.outcome === "failed") return { status: 200 };
    if (row.outcome === "failed" && input.outcome === "paid") {
      const upgraded = rowsOf(await input.sql.query(UPGRADE_FAILED_PAYMENT, [input.paymentId]));
      if (upgraded.length === 0) return { status: 200 };
      row = { ...row, outcome: "paid", emailSent: false };
    }
  }

  if (input.outcome === "failed" && row.outcome === "failed") {
    const failed = await markOrderFailed(input.reference, input.sql);
    if (failed) return { status: 200 };
    const existing = await findOrder(input.reference, input.sql);
    return { status: existing ? 200 : 500 };
  }

  const paid = await markOrderPaid(input.reference, input.sql);
  if (!paid) return { status: 500 };

  const claimed = rowsOf(await input.sql.query(CLAIM_EMAIL, [input.paymentId]));
  if (claimed.length === 0) return { status: 200 };

  const confirmation = await input.sendConfirmation(paid);
  if (confirmation !== "sent") {
    await input.sql.query(RELEASE_EMAIL, [input.paymentId]);
    return { status: 500 };
  }
  return { status: 200 };
}

