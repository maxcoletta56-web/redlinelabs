import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { handleWhopWebhook } from "./whop-webhook.ts";

type Row = {
  reference: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  first_name: string;
  last_name: string;
  email: string;
  items: unknown[];
  payment_method: string;
  whop_payment_id: string | null;
  paid_at: string | null;
};

function memory(initial: Row) {
  let row = { ...initial };
  const updates: string[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("CREATE") || query.startsWith("SELECT column")) return [];
      if (query.includes("FROM orders WHERE")) return [row];
      const reference = String(params?.[0] ?? "");
      const paymentId = String(params?.[1] ?? "");
      if (!query.startsWith("UPDATE") || row.reference !== reference) return [];
      updates.push(query);
      if (query.includes("status = 'paid'")) {
        const canPay =
          row.payment_method === "card" &&
          row.status !== "paid" &&
          (row.whop_payment_id == null || row.whop_payment_id === paymentId || row.status === "failed");
        if (!canPay) return [];
        row = { ...row, status: "paid", whop_payment_id: paymentId, paid_at: "2026-09-30T00:00:00Z" };
        return [row];
      }
      if (query.includes("status = 'failed'")) {
        const canFail =
          row.payment_method === "card" &&
          row.status === "pending" &&
          (row.whop_payment_id == null || row.whop_payment_id === paymentId);
        if (!canFail) return [];
        row = { ...row, status: "failed", whop_payment_id: paymentId };
        return [row];
      }
      return [];
    },
  };
  return { sql, updates, current: () => row };
}

const pending: Row = {
  reference: "RL-7F3K2Q",
  status: "pending",
  currency: "aud",
  subtotal_cents: 22000,
  total_cents: 19800,
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  items: [],
  payment_method: "card",
  whop_payment_id: null,
  paid_at: null,
};

function succeeded(paymentId: string, total = 198) {
  return {
    type: "payment.succeeded",
    data: {
      id: paymentId,
      total,
      currency: "aud",
      metadata: { orderId: "RL-7F3K2Q" },
    },
  };
}

test("a succeeded payment marks the order paid once and sends one email", async () => {
  const db = memory(pending);
  const sent: string[] = [];
  const first = await handleWhopWebhook(succeeded("pay_card1"), {
    sql: db.sql,
    deliver: async (order) => {
      sent.push(order.reference);
    },
  });
  const second = await handleWhopWebhook(succeeded("pay_card1"), {
    sql: db.sql,
    deliver: async () => {
      sent.push("again");
    },
  });
  assert.equal(first.outcome, "paid");
  assert.equal(second.outcome, "duplicate");
  assert.deepEqual(sent, ["RL-7F3K2Q"]);
  assert.equal(db.current().status, "paid");
  assert.equal(db.current().whop_payment_id, "pay_card1");
});

test("a failed payment does not overwrite a paid order", async () => {
  const db = memory(pending);
  await handleWhopWebhook(succeeded("pay_card1"), { sql: db.sql, deliver: async () => {} });
  const failed = await handleWhopWebhook(
    {
      type: "payment.failed",
      data: { id: "pay_card1", currency: "aud", metadata: { orderId: "RL-7F3K2Q" } },
    },
    { sql: db.sql },
  );
  assert.equal(failed.outcome, "ignored");
  assert.equal(db.current().status, "paid");
});

test("a decline marks the order failed, and a later success can still pay it", async () => {
  const db = memory(pending);
  const sent: string[] = [];
  const failed = await handleWhopWebhook(
    {
      type: "payment.failed",
      data: { id: "pay_fail1", currency: "aud", metadata: { order_id: "rl-7f3k2q" } },
    },
    { sql: db.sql },
  );
  const again = await handleWhopWebhook(
    {
      type: "payment.failed",
      data: { id: "pay_fail1", currency: "aud", metadata: { orderId: "RL-7F3K2Q" } },
    },
    { sql: db.sql },
  );
  const paid = await handleWhopWebhook(succeeded("pay_card2"), {
    sql: db.sql,
    deliver: async () => {
      sent.push("paid");
    },
  });
  assert.equal(failed.outcome, "failed");
  assert.equal(again.outcome, "duplicate");
  assert.equal(paid.outcome, "paid");
  assert.deepEqual(sent, ["paid"]);
  assert.equal(db.current().whop_payment_id, "pay_card2");
});

test("a payment whose gross amount does not match is not marked paid", async () => {
  const db = memory(pending);
  const sent: string[] = [];
  const result = await handleWhopWebhook(
    {
      type: "payment.succeeded",
      data: {
        id: "pay_short",
        amount_after_fees: 9.71,
        currency: "aud",
        metadata: { orderId: "RL-7F3K2Q" },
      },
    },
    {
      sql: db.sql,
      deliver: async () => {
        sent.push("no");
      },
    },
  );
  assert.equal(result.outcome, "amount_mismatch");
  assert.equal(db.current().status, "pending");
  assert.deepEqual(sent, []);
  assert.equal(db.updates.length, 0);
});
