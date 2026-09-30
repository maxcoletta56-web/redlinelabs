import "server-only";

import { getSql, rowsOf, type Sql } from "@/lib/db";
import { sendPaymentReceivedEmail } from "@/lib/mailer";
import { findOrder, markOrderFailed, markOrderPaid, type StoredOrder } from "@/lib/orders";
import { normalizeOrderReference } from "@/lib/order-reference";
import {
  readPaymentEvent,
  readWebhookHeaders,
  verifyWhopWebhook,
  WhopSignatureError,
} from "@/lib/whop";

const CREATE_WHOP_PAYMENTS = `CREATE TABLE IF NOT EXISTS whop_payments (
  payment_id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export type WhopWebhookResult = {
  status: number;
  outcome: "ignored" | "paid" | "failed" | "duplicate" | "unauthorized" | "misconfigured";
};

export type HandleWhopWebhookOptions = {
  sql?: Sql | null;
  secret?: string | null;
  nowMs?: number;
  deliver?: (order: StoredOrder) => Promise<void>;
};

type Claim = "claimed" | "duplicate";

async function ensurePayments(sql: Sql) {
  const { ensureTable } = await import("@/lib/db");
  await ensureTable(sql, "whop_payments", CREATE_WHOP_PAYMENTS);
}

async function claimPayment(
  sql: Sql,
  paymentId: string,
  reference: string,
  outcome: "paid" | "failed",
): Promise<Claim> {
  await ensurePayments(sql);
  const inserted = await sql.query(
    "INSERT INTO whop_payments (payment_id, order_reference, outcome) VALUES ($1, $2, $3) " +
      "ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id",
    [paymentId, reference, outcome],
  );
  if (rowsOf(inserted).length > 0) return "claimed";
  if (outcome !== "paid") return "duplicate";
  const upgraded = await sql.query(
    "UPDATE whop_payments SET outcome = 'paid' WHERE payment_id = $1 AND outcome = 'failed' RETURNING payment_id",
    [paymentId],
  );
  return rowsOf(upgraded).length > 0 ? "claimed" : "duplicate";
}

async function releaseClaim(sql: Sql, paymentId: string) {
  await sql.query("DELETE FROM whop_payments WHERE payment_id = $1", [paymentId]);
}

async function deliverConfirmation(order: StoredOrder) {
  await sendPaymentReceivedEmail({
    reference: order.reference,
    firstName: order.firstName,
    email: order.email,
    totalCents: order.totalCents,
  });
}

/**
 * Verifies the Whop signature, then applies `payment.succeeded` or
 * `payment.failed` once per Whop payment id. The confirmation email is sent
 * only on the first successful claim for that payment.
 */
export async function handleWhopWebhook(
  rawBody: string,
  headers: Headers,
  options?: HandleWhopWebhookOptions,
): Promise<WhopWebhookResult> {
  const secret =
    options && "secret" in options ? (options.secret ?? "") : (process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "");
  if (!secret) {
    console.error("[whop] WHOP_WEBHOOK_SECRET is not set");
    return { status: 500, outcome: "misconfigured" };
  }

  const webhookHeaders = readWebhookHeaders(headers);
  if (!webhookHeaders) {
    return { status: 401, outcome: "unauthorized" };
  }
  try {
    verifyWhopWebhook(rawBody, webhookHeaders, secret, options?.nowMs);
  } catch (error) {
    if (error instanceof WhopSignatureError) {
      return { status: 401, outcome: "unauthorized" };
    }
    throw error;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, outcome: "ignored" };
  }
  const event = readPaymentEvent(payload);
  if (!event) {
    return { status: 200, outcome: "ignored" };
  }
  const reference = normalizeOrderReference(event.orderId);
  if (!reference) {
    console.error("[whop] payment metadata is missing a valid orderId", { paymentId: event.paymentId });
    return { status: 200, outcome: "ignored" };
  }

  const sql = options && "sql" in options ? (options.sql ?? null) : getSql();
  if (!sql) {
    console.error("[whop] DATABASE_URL is not set");
    return { status: 500, outcome: "misconfigured" };
  }

  const existing = await findOrder(reference, sql);
  if (!existing) {
    console.error("[whop] payment does not match an order", {
      paymentId: event.paymentId,
      reference,
    });
    return { status: 200, outcome: "ignored" };
  }

  const outcome = event.type === "payment.succeeded" ? "paid" : "failed";
  const claim = await claimPayment(sql, event.paymentId, reference, outcome);
  if (claim === "duplicate") {
    return { status: 200, outcome: "duplicate" };
  }

  try {
    if (outcome === "paid") {
      const paid = await markOrderPaid(reference, sql);
      if (!paid) throw new Error("Paid order update did not return a row");
      if (options?.deliver) await options.deliver(paid);
      else await deliverConfirmation(paid);
      return { status: 200, outcome: "paid" };
    }
    await markOrderFailed(reference, sql);
    return { status: 200, outcome: "failed" };
  } catch (error) {
    await releaseClaim(sql, event.paymentId).catch(() => undefined);
    console.error("[whop] webhook apply failed", {
      paymentId: event.paymentId,
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message.slice(0, 300) : "unknown",
    });
    return { status: 500, outcome: "failed" };
  }
}
