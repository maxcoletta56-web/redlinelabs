import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Sql } from "./db.ts";
import type { StoredOrder } from "./orders.ts";
import { handleWhopWebhook } from "./whop-webhook.ts";

const secret = "ws_sandbox_secret_value";
const now = 1_800_000_000_000;

function headersFor(body: string) {
  const timestamp = String(Math.floor(now / 1000));
  const signature = createHmac("sha256", secret).update(`msg_test.${timestamp}.${body}`).digest("base64");
  return new Headers({
    "webhook-id": "msg_test",
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  });
}

function database() {
  const orders = new Map<string, Record<string, unknown>>();
  const payments = new Map<string, string>();
  orders.set("RL-7F3K2Q", {
    reference: "RL-7F3K2Q",
    status: "pending",
    currency: "aud",
    subtotal_cents: 26_700,
    total_cents: 19_224,
    promo_code: "DGC20",
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    items: "[]",
    shipping: null,
  });
  const sql: Sql = {
    query: async (query, params) => {
      const reference = String(params?.[0] ?? "");
      if (query.startsWith("CREATE")) return [];
      if (query.startsWith("SELECT") && query.includes("FROM orders")) {
        const order = orders.get(reference);
        return order ? [order] : [];
      }
      if (query.startsWith("INSERT INTO whop_payments")) {
        const paymentId = String(params?.[0]);
        if (payments.has(paymentId)) return [];
        payments.set(paymentId, String(params?.[2]));
        return [{ payment_id: paymentId }];
      }
      if (query.startsWith("UPDATE whop_payments")) {
        const paymentId = String(params?.[0]);
        if (payments.get(paymentId) !== "failed") return [];
        payments.set(paymentId, "paid");
        return [{ payment_id: paymentId }];
      }
      if (query.startsWith("DELETE FROM whop_payments")) {
        payments.delete(String(params?.[0]));
        return [];
      }
      if (query.includes("status = 'paid'")) {
        const order = orders.get(reference);
        if (!order) return [];
        order.status = "paid";
        order.paid_at = order.paid_at ?? "2026-09-30T00:00:00Z";
        return [order];
      }
      if (query.includes("status = 'failed'")) {
        const order = orders.get(reference);
        if (!order || order.status !== "pending") return [];
        order.status = "failed";
        return [order];
      }
      return [];
    },
  };
  return { sql, orders, payments };
}

function event(type: "payment.succeeded" | "payment.failed", paymentId: string) {
  return JSON.stringify({
    type,
    data: { id: paymentId, metadata: { orderId: "RL-7F3K2Q" } },
  });
}

test("payment.succeeded marks the order paid once and emails once", async () => {
  const { sql, orders } = database();
  const sent: StoredOrder[] = [];
  const body = event("payment.succeeded", "pay_once123");
  const headers = headersFor(body);
  const first = await handleWhopWebhook(body, headers, {
    sql,
    secret,
    nowMs: now,
    deliver: async (order) => {
      sent.push(order);
    },
  });
  const second = await handleWhopWebhook(body, headers, {
    sql,
    secret,
    nowMs: now,
    deliver: async (order) => {
      sent.push(order);
    },
  });
  assert.equal(first.outcome, "paid");
  assert.equal(second.outcome, "duplicate");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.reference, "RL-7F3K2Q");
  assert.equal(orders.get("RL-7F3K2Q")?.status, "paid");
});

test("payment.failed marks a pending order failed and does not email", async () => {
  const { sql, orders } = database();
  let mailed = 0;
  const body = event("payment.failed", "pay_fail123");
  const result = await handleWhopWebhook(body, headersFor(body), {
    sql,
    secret,
    nowMs: now,
    deliver: async () => {
      mailed += 1;
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.outcome, "failed");
  assert.equal(orders.get("RL-7F3K2Q")?.status, "failed");
  assert.equal(mailed, 0);
});

test("a bad signature does not change the order", async () => {
  const { sql, orders } = database();
  const body = event("payment.succeeded", "pay_bad123");
  const headers = headersFor(body);
  headers.set("webhook-signature", "v1,bm90LXZhbGlk");
  const result = await handleWhopWebhook(body, headers, { sql, secret, nowMs: now });
  assert.equal(result.status, 401);
  assert.equal(orders.get("RL-7F3K2Q")?.status, "pending");
});

test("the same payment id does not email again after a retry of payment.succeeded", async () => {
  const { sql } = database();
  let mailed = 0;
  const failed = event("payment.failed", "pay_same123");
  await handleWhopWebhook(failed, headersFor(failed), { sql, secret, nowMs: now });
  const succeeded = event("payment.succeeded", "pay_same123");
  const upgraded = await handleWhopWebhook(succeeded, headersFor(succeeded), {
    sql,
    secret,
    nowMs: now,
    deliver: async () => {
      mailed += 1;
    },
  });
  const again = await handleWhopWebhook(succeeded, headersFor(succeeded), {
    sql,
    secret,
    nowMs: now,
    deliver: async () => {
      mailed += 1;
    },
  });
  assert.equal(upgraded.outcome, "paid");
  assert.equal(again.outcome, "duplicate");
  assert.equal(mailed, 1);
});
