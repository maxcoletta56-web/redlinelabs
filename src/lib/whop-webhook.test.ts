import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { Sql } from "./db.ts";
import { handleWhopWebhook } from "./whop-webhook.ts";

const SECRET = "ws_test_secret";
const NOW = 1_760_000_000_000;

function signed(payload: unknown) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(NOW / 1000));
  const id = "msg_test";
  const signature = createHmac("sha256", SECRET)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    body,
    headers: new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    }),
  };
}

function payment(type: string, paymentId: string, amount = "306.00", planId = "plan_test") {
  return {
    type,
    data: {
      id: paymentId,
      metadata: { orderId: "RL-7F3K2Q" },
      total: { amount, currency: "aud", decimals: 2, display_decimals: 2 },
      variant_id: planId,
      checkout_configuration_id: "ch_test",
    },
  };
}

function memoryOrder() {
  let row: Record<string, unknown> = {
    reference: "RL-7F3K2Q",
    status: "pending",
    currency: "aud",
    subtotal_cents: 34000,
    total_cents: 30600,
    promo_code: null,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    club_email: null,
    club_points_redeemed: 0,
    club_discount_cents: 0,
    payment_method: "whop",
    paypal_order_id: null,
    whop_payment_id: null,
    whop_checkout_id: "ch_test",
    whop_plan_id: "plan_test",
    created_at: "2026-10-29T00:00:00Z",
    paid_at: null,
  };
  const sql: Sql = {
    query: async (query, params = []) => {
      if (query.startsWith("SELECT")) {
        return row.reference === params[0] ? [{ ...row }] : [];
      }
      if (query.includes("SET status = 'paid'")) {
        const [reference, paymentId, amountCents, currency] = params;
        const open = row.status === "pending" || row.status === "failed" || row.status === "awaiting_payment";
        const sameAttempt =
          row.whop_payment_id == null || row.whop_payment_id === paymentId || row.status === "failed";
        if (
          row.reference !== reference ||
          row.payment_method !== "whop" ||
          row.total_cents !== amountCents ||
          String(row.currency).toLowerCase() !== String(currency).toLowerCase() ||
          !open ||
          !sameAttempt
        ) {
          return [];
        }
        row = {
          ...row,
          status: "paid",
          whop_payment_id: paymentId,
          paid_at: row.paid_at ?? "2026-10-29T01:00:00Z",
        };
        return [{ ...row }];
      }
      if (query.includes("SET status = 'failed'")) {
        const [reference, paymentId, amountCents, currency] = params;
        if (
          row.reference !== reference ||
          row.status !== "pending" ||
          row.total_cents !== amountCents ||
          String(row.currency).toLowerCase() !== String(currency).toLowerCase() ||
          (row.whop_payment_id != null && row.whop_payment_id !== paymentId)
        ) {
          return [];
        }
        row = { ...row, status: "failed", whop_payment_id: paymentId };
        return [{ ...row }];
      }
      return [];
    },
  };
  return {
    sql,
    status: () => row.status,
    paymentId: () => row.whop_payment_id,
  };
}

function deliver(store: ReturnType<typeof memoryOrder>) {
  const emails: string[] = [];
  return {
    emails,
    options: {
      env: { WHOP_WEBHOOK_SECRET: SECRET },
      sql: store.sql,
      nowMs: NOW,
      notifyPaid: async (order: { reference: string }) => {
        emails.push(order.reference);
      },
    },
  };
}

test("a forged webhook is rejected before any order update", async () => {
  const store = memoryOrder();
  const { body, headers } = signed(payment("payment.succeeded", "pay_1"));
  headers.set("webhook-signature", "v1,forged");
  const result = await handleWhopWebhook(body, headers, deliver(store).options);
  assert.equal(result.status, 401);
  assert.equal(store.status(), "pending");
});

test("payment.succeeded marks the order paid and emails once per Whop payment id", async () => {
  const store = memoryOrder();
  const hook = deliver(store);
  const first = signed(payment("payment.succeeded", "pay_1"));
  const paid = await handleWhopWebhook(first.body, first.headers, hook.options);
  assert.equal(paid.status, 200);
  assert.equal(store.status(), "paid");
  assert.deepEqual(hook.emails, ["RL-7F3K2Q"]);

  const again = signed(payment("payment.succeeded", "pay_1"));
  const replay = await handleWhopWebhook(again.body, again.headers, hook.options);
  assert.equal(replay.status, 200);
  assert.deepEqual(hook.emails, ["RL-7F3K2Q"]);
});

test("a mismatched amount does not mark the order paid", async () => {
  const store = memoryOrder();
  const hook = deliver(store);
  const event = signed(payment("payment.succeeded", "pay_cheap", "1.00"));
  const result = await handleWhopWebhook(event.body, event.headers, hook.options);
  assert.equal(result.status, 200);
  assert.equal(store.status(), "pending");
  assert.deepEqual(hook.emails, []);
});

test("payment.failed then a later success sends one confirmation", async () => {
  const store = memoryOrder();
  const hook = deliver(store);
  const failed = signed(payment("payment.failed", "pay_fail"));
  await handleWhopWebhook(failed.body, failed.headers, hook.options);
  assert.equal(store.status(), "failed");
  assert.equal(store.paymentId(), "pay_fail");

  const retry = signed(payment("payment.failed", "pay_fail"));
  await handleWhopWebhook(retry.body, retry.headers, hook.options);
  assert.equal(store.status(), "failed");

  const succeeded = signed(payment("payment.succeeded", "pay_ok"));
  await handleWhopWebhook(succeeded.body, succeeded.headers, hook.options);
  assert.equal(store.status(), "paid");
  assert.equal(store.paymentId(), "pay_ok");
  assert.deepEqual(hook.emails, ["RL-7F3K2Q"]);
});

test("payment.requires_action leaves the order pending", async () => {
  const store = memoryOrder();
  const hook = deliver(store);
  const event = signed({ type: "payment.requires_action", data: { id: "pay_3ds" } });
  const result = await handleWhopWebhook(event.body, event.headers, hook.options);
  assert.equal(result.status, 200);
  assert.equal(store.status(), "pending");
  assert.deepEqual(hook.emails, []);
});

test("a payment for a different plan does not settle this order", async () => {
  const store = memoryOrder();
  const hook = deliver(store);
  const event = signed(payment("payment.succeeded", "pay_other", "306.00", "plan_other"));
  const result = await handleWhopWebhook(event.body, event.headers, hook.options);
  assert.equal(result.status, 200);
  assert.equal(store.status(), "pending");
  assert.deepEqual(hook.emails, []);
});
