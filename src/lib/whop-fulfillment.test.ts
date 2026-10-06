import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import type { StoredOrder } from "./orders.ts";
import { fulfillWhopPayment } from "./whop-fulfillment.ts";

function order(status: StoredOrder["status"]): StoredOrder {
  return {
    reference: "RL-7F3K2Q",
    status,
    currency: "aud",
    subtotalCents: 26700,
    totalCents: 24030,
    promoCode: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    createdAt: null,
    paidAt: status === "paid" ? "2026-10-06T00:00:00Z" : null,
  };
}

function sqlFor(claimed: { value: boolean }) {
  const calls: string[] = [];
  const sql: Sql = {
    query: async (query) => {
      calls.push(query);
      if (query.startsWith("INSERT")) {
        if (claimed.value) return [];
        claimed.value = true;
        return [{ payment_id: "pay_testpayment" }];
      }
      return [];
    },
  };
  return { calls, sql };
}

test("payment.succeeded marks the order paid and emails once", async () => {
  const claimed = { value: false };
  const { sql } = sqlFor(claimed);
  let emailed = 0;
  const first = await fulfillWhopPayment(
    { type: "payment.succeeded", paymentId: "pay_testpayment", orderId: "rl-7f3k2q" },
    {
      sql,
      findOrder: async () => order("pending"),
      markOrderPaidWithPaymentEmail: async () => {
        emailed += 1;
        return order("paid");
      },
    },
  );
  assert.equal(first.outcome, "paid");
  assert.equal(emailed, 1);

  const second = await fulfillWhopPayment(
    { type: "payment.succeeded", paymentId: "pay_testpayment", orderId: "RL-7F3K2Q" },
    {
      sql,
      findOrder: async () => order("paid"),
      markOrderPaidWithPaymentEmail: async () => {
        emailed += 1;
        return order("paid");
      },
    },
  );
  assert.equal(second.outcome, "duplicate");
  assert.equal(emailed, 1);
});

test("payment.failed marks a pending order failed and does not unwind a paid order", async () => {
  const claimed = { value: false };
  const { sql } = sqlFor(claimed);
  let failedCalls = 0;
  const failed = await fulfillWhopPayment(
    { type: "payment.failed", paymentId: "pay_failedpayment", orderId: "RL-7F3K2Q" },
    {
      sql,
      findOrder: async () => order("pending"),
      markOrderFailed: async () => {
        failedCalls += 1;
        return order("failed");
      },
    },
  );
  assert.equal(failed.outcome, "failed");
  assert.equal(failedCalls, 1);

  const paidClaim = { value: false };
  const paid = await fulfillWhopPayment(
    { type: "payment.failed", paymentId: "pay_latefailure", orderId: "RL-7F3K2Q" },
    {
      sql: sqlFor(paidClaim).sql,
      findOrder: async () => order("paid"),
      markOrderFailed: async () => {
        throw new Error("should not mark a paid order failed");
      },
    },
  );
  assert.equal(paid.outcome, "already_paid");
});
