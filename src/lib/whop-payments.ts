import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import { normalizeOrderReference } from "./order-reference.ts";
import {
  ensureOrdersTable,
  findOrder,
  markWhopOrderFailed,
  markWhopOrderPaid,
  type StoredOrder,
} from "./orders.ts";
import type { WhopWebhookEvent } from "./whop-webhook.ts";

export const CREATE_WHOP_PAYMENT_EVENTS = `CREATE TABLE IF NOT EXISTS whop_payment_events (
  payment_id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

/**
 * First delivery inserts the payment id. A later `payment.succeeded` may
 * replace a stored `payment.failed` for that same id. Any other repeat matches
 * nothing, which is what keeps the confirmation email from sending twice.
 */
const CLAIM_WHOP_PAYMENT =
  "INSERT INTO whop_payment_events (payment_id, order_reference, event_type) " +
  "VALUES ($1, $2, $3) " +
  "ON CONFLICT (payment_id) DO UPDATE " +
  "SET event_type = EXCLUDED.event_type " +
  "WHERE whop_payment_events.event_type IS DISTINCT FROM 'payment.succeeded' " +
  "AND EXCLUDED.event_type = 'payment.succeeded' " +
  "RETURNING payment_id";

export type WhopPaymentNotice = {
  reference: string;
  firstName: string;
  email: string;
  totalCents: number;
};

export function ensureWhopPaymentEvents(sql: Sql) {
  return ensureTable(sql, "whop_payment_events", CREATE_WHOP_PAYMENT_EVENTS);
}

async function claimWhopPayment(sql: Sql, paymentId: string, reference: string, eventType: string) {
  await ensureWhopPaymentEvents(sql);
  const result = await sql.query(CLAIM_WHOP_PAYMENT, [paymentId, reference, eventType]);
  return rowsOf(result).length > 0;
}

function noticeFor(order: StoredOrder): WhopPaymentNotice {
  return {
    reference: order.reference,
    firstName: order.firstName,
    email: order.email,
    totalCents: order.totalCents,
  };
}

export async function settleWhopWebhook(
  event: Pick<WhopWebhookEvent, "type" | "paymentId" | "orderId">,
  options?: { sql?: Sql | null },
): Promise<{ email: WhopPaymentNotice | null }> {
  if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
    return { email: null };
  }
  if (!event.paymentId || !event.orderId) return { email: null };
  const reference = normalizeOrderReference(event.orderId);
  if (!reference) return { email: null };

  const sql = options && "sql" in options ? (options.sql ?? null) : getSql();
  if (!sql) throw new Error("DATABASE_URL is not set");
  await ensureOrdersTable(sql);

  const claimed = await claimWhopPayment(sql, event.paymentId, reference, event.type);
  if (!claimed) return { email: null };

  if (event.type === "payment.failed") {
    await markWhopOrderFailed(reference, event.paymentId, sql);
    return { email: null };
  }

  const settled = await markWhopOrderPaid(reference, event.paymentId, sql);
  const order = settled.order ?? (await findOrder(reference, sql));
  if (!order) return { email: null };
  return { email: noticeFor(order) };
}
