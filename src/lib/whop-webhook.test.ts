import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import type { StoredOrder } from "./orders.ts";
import { handleWhopWebhookEvent } from "./whop-webhook.ts";
import type { WhopWebhookEvent } from "./whop.ts";

type Row = {
  reference: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  promo_code: string | null;
  first_name: string;
  last_name: string;
  email: string;
  items: unknown[];
  shipping: null;
  created_at: string;
  paid_at: string | null;
  whop_payment_id: string | null;
};

function pendingOrder(): Row {
  return {
    reference: "RL-234567",
    status: "pending",
    currency: "aud",
    subtotal_cents: 26700,
    total_cents: 24030,
    promo_code: null,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    created_at: "2026-10-05T00:00:00Z",
    paid_at: null,
    whop_payment_id: null,
  };
}

function memorySql(initial: Row) {
  let current = initial;
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("SELECT")) {
        return current.reference === params?.[0] ? [{ ...current }] : [];
      }
      if (query.includes("status = 'paid'") && query.includes("whop_payment_id = $2")) {
        const paymentId = String(params?.[1] ?? "");
        const samePayment = current.whop_payment_id == null || current.whop_payment_id === paymentId;
        if (current.reference === params?.[0] && current.status !== "paid" && samePayment) {
          current = {
            ...current,
            status: "paid",
            whop_payment_id: paymentId,
            paid_at: current.paid_at ?? "2026-10-05T01:00:00Z",
          };
          return [{ ...current }];
        }
        return [];
      }
      if (query.includes("status = 'failed'")) {
        const paymentId = String(params?.[1] ?? "");
        if (current.reference === params?.[0] && current.status === "pending" && current.whop_payment_id == null) {
          current = { ...current, status: "failed", whop_payment_id: paymentId };
          return [{ ...current }];
        }
        return [];
      }
      return [];
    },
  };
  return {
    sql,
    read: () => current,
  };
}

function succeeded(total: number, paymentId = "pay_sandbox_1"): WhopWebhookEvent {
  return {
    type: "payment.succeeded",
    data: {
      id: paymentId,
      currency: "aud",
      total,
      metadata: { orderId: "RL-234567" },
    },
  };
}

test("payment.succeeded marks the order paid once and emails once", async () => {
  const db = memorySql(pendingOrder());
  const emailed: StoredOrder[] = [];
  const first = await handleWhopWebhookEvent(succeeded(240.3), {
    sql: db.sql,
    deliver: async (order) => {
      emailed.push(order);
    },
  });
  const second = await handleWhopWebhookEvent(succeeded(240.3), {
    sql: db.sql,
    deliver: async (order) => {
      emailed.push(order);
    },
  });
  assert.equal(first.outcome, "paid");
  assert.equal(second.outcome, "ignored");
  assert.equal(emailed.length, 1);
  assert.equal(db.read().status, "paid");
  assert.equal(db.read().whop_payment_id, "pay_sandbox_1");
});

test("a mismatched amount does not mark the order paid", async () => {
  const db = memorySql(pendingOrder());
  let emails = 0;
  const result = await handleWhopWebhookEvent(succeeded(1), {
    sql: db.sql,
    deliver: async () => {
      emails += 1;
    },
  });
  assert.equal(result.outcome, "mismatch");
  assert.equal(emails, 0);
  assert.equal(db.read().status, "pending");
});

test("payment.failed is idempotent and does not override a paid order", async () => {
  const db = memorySql(pendingOrder());
  const failedEvent: WhopWebhookEvent = {
    type: "payment.failed",
    data: { id: "pay_failed_1", metadata: { orderId: "RL-234567" } },
  };
  const first = await handleWhopWebhookEvent(failedEvent, { sql: db.sql, deliver: async () => undefined });
  const second = await handleWhopWebhookEvent(failedEvent, { sql: db.sql, deliver: async () => undefined });
  assert.equal(first.outcome, "failed");
  assert.equal(second.outcome, "ignored");
  assert.equal(db.read().status, "failed");

  const recovered = await handleWhopWebhookEvent(succeeded(240.3, "pay_failed_1"), {
    sql: db.sql,
    deliver: async () => undefined,
  });
  assert.equal(recovered.outcome, "paid");
  assert.equal(db.read().status, "paid");

  const afterPaid = await handleWhopWebhookEvent(
    { type: "payment.failed", data: { id: "pay_failed_2", metadata: { orderId: "RL-234567" } } },
    { sql: db.sql, deliver: async () => undefined },
  );
  assert.equal(afterPaid.outcome, "ignored");
  assert.equal(db.read().status, "paid");
});
