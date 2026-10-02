import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { settleWhopWebhook } from "./whop-payments.ts";

function memorySql() {
  const calls: { query: string; params?: unknown[] }[] = [];
  const claims = new Map<string, string>();
  const orders = new Map<string, { status: string; whopPaymentId: string | null }>();
  orders.set("RL-7F3K2Q", { status: "pending", whopPaymentId: null });
  const sql: Sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      if (query.startsWith("INSERT INTO whop_payment_events")) {
        const paymentId = String(params?.[0]);
        const eventType = String(params?.[2]);
        const existing = claims.get(paymentId);
        if (!existing) {
          claims.set(paymentId, eventType);
          return [{ payment_id: paymentId }];
        }
        if (existing !== "payment.succeeded" && eventType === "payment.succeeded") {
          claims.set(paymentId, eventType);
          return [{ payment_id: paymentId }];
        }
        return [];
      }
      if (query.includes("status = 'paid'")) {
        const reference = String(params?.[0]);
        const order = orders.get(reference);
        if (!order || order.status === "paid") return [];
        order.status = "paid";
        order.whopPaymentId = String(params?.[1]);
        return [
          {
            reference,
            status: "paid",
            first_name: "Ada",
            email: "ada@example.com",
            total_cents: 24030,
            whop_payment_id: params?.[1],
          },
        ];
      }
      if (query.includes("status = 'failed'")) {
        const reference = String(params?.[0]);
        const order = orders.get(reference);
        if (!order || order.status !== "pending") return [];
        order.status = "failed";
        order.whopPaymentId = String(params?.[1]);
        return [{ reference, status: "failed", whop_payment_id: params?.[1] }];
      }
      if (query.startsWith("SELECT")) {
        const reference = String(params?.[0]);
        const order = orders.get(reference);
        if (!order) return [];
        return [{ reference, status: order.status, whop_payment_id: order.whopPaymentId }];
      }
      return [];
    },
  };
  return { sql, calls };
}

test("payment.succeeded marks the order paid once and only the first delivery asks for email", async () => {
  const { sql, calls } = memorySql();
  const event = { type: "payment.succeeded", paymentId: "pay_abc123", orderId: "RL-7F3K2Q" };
  const first = await settleWhopWebhook(event, { sql });
  const second = await settleWhopWebhook(event, { sql });
  assert.equal(first.email?.reference, "RL-7F3K2Q");
  assert.equal(first.email?.totalCents, 24030);
  assert.equal(second.email, null);
  assert.equal(
    calls.some((call) => call.query.includes("ON CONFLICT (payment_id)")),
    true,
  );
});

test("payment.failed marks a pending order failed and does not ask for email", async () => {
  const { sql } = memorySql();
  const failed = await settleWhopWebhook(
    { type: "payment.failed", paymentId: "pay_fail1", orderId: "RL-7F3K2Q" },
    { sql },
  );
  assert.equal(failed.email, null);
  const again = await settleWhopWebhook(
    { type: "payment.failed", paymentId: "pay_fail1", orderId: "RL-7F3K2Q" },
    { sql },
  );
  assert.equal(again.email, null);
});

test("a succeeded payment can follow a failed one for the same Whop payment id", async () => {
  const { sql } = memorySql();
  await settleWhopWebhook(
    { type: "payment.failed", paymentId: "pay_same", orderId: "RL-7F3K2Q" },
    { sql },
  );
  const paid = await settleWhopWebhook(
    { type: "payment.succeeded", paymentId: "pay_same", orderId: "rl-7f3k2q" },
    { sql },
  );
  assert.equal(paid.email?.reference, "RL-7F3K2Q");
  const repeat = await settleWhopWebhook(
    { type: "payment.succeeded", paymentId: "pay_same", orderId: "RL-7F3K2Q" },
    { sql },
  );
  assert.equal(repeat.email, null);
});
