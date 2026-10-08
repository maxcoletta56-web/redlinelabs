import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { applyWhopPayment, type StoredOrder } from "./orders.ts";
import { handleWhopWebhookEvent } from "./whop-webhook.ts";

const paymentId = "pay_abc12345";
const secondPaymentId = "pay_second99";

function order(overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    reference: "RL-7F3K2Q",
    status: "pending",
    currency: "aud",
    subtotalCents: 20000,
    totalCents: 18000,
    promoCode: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    paymentMethod: "whop",
    paypalOrderId: null,
    whopCheckoutId: "ch_abc123",
    whopPaymentId: null,
    whopHandledPaymentIds: [],
    createdAt: "2026-10-08T00:00:00.000Z",
    paidAt: null,
    ...overrides,
  };
}

function memorySql(initial: StoredOrder) {
  let current = initial;
  const sql: Sql = {
    query: async (query, params) => {
      const payment = String(params?.[1] ?? "");
      if (query.startsWith("UPDATE") && query.includes("status = 'paid'")) {
        if (current.status === "paid" || current.whopHandledPaymentIds.includes(payment)) return [];
        if (current.paymentMethod !== "whop") return [];
        current = {
          ...current,
          status: "paid",
          paidAt: current.paidAt ?? "2026-10-08T01:00:00.000Z",
          whopPaymentId: payment,
          whopHandledPaymentIds: [...current.whopHandledPaymentIds, payment],
        };
        return [currentRow(current)];
      }
      if (query.startsWith("UPDATE") && query.includes("status = 'failed'")) {
        if (current.status !== "pending" || current.whopHandledPaymentIds.includes(payment)) return [];
        current = {
          ...current,
          status: "failed",
          whopPaymentId: payment,
          whopHandledPaymentIds: [...current.whopHandledPaymentIds, payment],
        };
        return [currentRow(current)];
      }
      if (query.startsWith("SELECT")) return [currentRow(current)];
      return [];
    },
  };
  return {
    sql,
    read: () => current,
  };
}

function currentRow(row: StoredOrder) {
  return {
    reference: row.reference,
    status: row.status,
    currency: row.currency,
    subtotal_cents: row.subtotalCents,
    total_cents: row.totalCents,
    promo_code: row.promoCode,
    first_name: row.firstName,
    last_name: row.lastName,
    email: row.email,
    items: row.items,
    shipping: row.shipping,
    payment_method: row.paymentMethod,
    paypal_order_id: row.paypalOrderId,
    whop_checkout_id: row.whopCheckoutId,
    whop_payment_id: row.whopPaymentId,
    whop_handled_payment_ids: row.whopHandledPaymentIds,
    created_at: row.createdAt,
    paid_at: row.paidAt,
  };
}

function event(type: "payment.succeeded" | "payment.failed", id = paymentId, total = 180) {
  return {
    id: "msg_123",
    type,
    data: {
      id,
      currency: "aud",
      total,
      metadata: { orderId: "RL-7F3K2Q" },
    },
  };
}

test("a succeeded payment marks the order paid once and emails once", async () => {
  const db = memorySql(order());
  const sent: string[] = [];
  const first = await handleWhopWebhookEvent(event("payment.succeeded"), {
    sql: db.sql,
    scheduleEmail: (_reference, task) => {
      void task();
    },
    sendPaymentReceivedEmail: async (notice) => {
      sent.push(notice.reference);
    },
  });
  assert.equal(first.action, "paid");
  assert.equal(db.read().status, "paid");
  assert.deepEqual(sent, ["RL-7F3K2Q"]);

  const second = await handleWhopWebhookEvent(event("payment.succeeded"), {
    sql: db.sql,
    scheduleEmail: () => {
      throw new Error("duplicate email");
    },
    sendPaymentReceivedEmail: async () => {
      sent.push("again");
    },
  });
  assert.equal(second.action, "duplicate");
  assert.deepEqual(sent, ["RL-7F3K2Q"]);
});

test("a failed payment is recorded and a later payment can still succeed", async () => {
  const db = memorySql(order());
  const failed = await handleWhopWebhookEvent(event("payment.failed"), { sql: db.sql });
  assert.equal(failed.action, "failed");
  assert.equal(db.read().status, "failed");

  const replay = await handleWhopWebhookEvent(event("payment.failed"), { sql: db.sql });
  assert.equal(replay.action, "duplicate");

  db.read().status = "pending";
  const paid = await handleWhopWebhookEvent(event("payment.succeeded", secondPaymentId), {
    sql: db.sql,
    scheduleEmail: (_reference, task) => {
      void task();
    },
    sendPaymentReceivedEmail: async () => undefined,
  });
  assert.equal(paid.action, "paid");
  assert.equal(db.read().whopPaymentId, secondPaymentId);
});

test("a payment whose amount does not match the order is ignored", async () => {
  const db = memorySql(order());
  const result = await handleWhopWebhookEvent(event("payment.succeeded", paymentId, 1), {
    sql: db.sql,
  });
  assert.equal(result.action, "ignored");
  assert.equal(db.read().status, "pending");
});

test("applyWhopPayment refuses a payment id that is not from Whop", async () => {
  const db = memorySql(order());
  const result = await applyWhopPayment(
    { reference: "RL-7F3K2Q", paymentId: "not-a-payment", nextStatus: "paid" },
    db.sql,
  );
  assert.deepEqual(result, { outcome: "ignored", reason: "invalid" });
});
