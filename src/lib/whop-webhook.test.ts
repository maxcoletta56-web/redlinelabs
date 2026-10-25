import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { applyWhopPayment, type StoredOrder } from "./orders.ts";
import { signWhopWebhook } from "./whop-signature.ts";
import { receiveWhopWebhook } from "./whop-webhook.ts";

const secret = "ws_test_secret";
const now = 1_700_000_000;

function headers(payload: string, id = "msg_1") {
  return {
    "webhook-id": id,
    "webhook-timestamp": String(now),
    "webhook-signature": signWhopWebhook(payload, secret, id, now),
  };
}

function order(reference: string, status: StoredOrder["status"], paymentId: string | null): StoredOrder {
  return {
    reference,
    status,
    currency: "aud",
    subtotalCents: 8900,
    totalCents: 8900,
    promoCode: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    clubEmail: null,
    clubPointsRedeemed: 0,
    clubDiscountCents: 0,
    paymentMethod: "whop",
    paypalOrderId: null,
    whopPaymentId: paymentId,
    createdAt: null,
    paidAt: status === "paid" ? "2026-10-19T00:00:00Z" : null,
  };
}

test("payment.succeeded pays once and a replay does not email again", async () => {
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_testpayment1", metadata: { orderId: "RL-ABC234" } },
  });
  const seen = new Set<string>();
  let emails = 0;
  const deps = {
    secret,
    nowSeconds: now,
    applyPayment: async (reference: string, paymentId: string, outcome: "paid" | "failed") => {
      const transitioned = !seen.has(paymentId);
      seen.add(paymentId);
      return {
        outcome,
        transitioned,
        order: order(reference, outcome === "paid" ? "paid" : "failed", paymentId),
      } as const;
    },
    sendConfirmation: async () => {
      emails += 1;
    },
  };
  const first = await receiveWhopWebhook(payload, headers(payload), deps);
  const second = await receiveWhopWebhook(payload, headers(payload, "msg_2"), deps);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(emails, 1);
});

test("payment.failed does not send a confirmation or unpay a settled order", async () => {
  const payload = JSON.stringify({
    type: "payment.failed",
    data: { id: "pay_failedone", metadata: { orderId: "RL-ABC234" } },
  });
  let emails = 0;
  let outcomeSeen: string | null = null;
  const result = await receiveWhopWebhook(payload, headers(payload), {
    secret,
    nowSeconds: now,
    applyPayment: async (reference, paymentId, outcome) => {
      outcomeSeen = outcome;
      return { outcome, transitioned: true, order: order(reference, "failed", paymentId) };
    },
    sendConfirmation: async () => {
      emails += 1;
    },
  });
  assert.equal(result.status, 200);
  assert.equal(outcomeSeen, "failed");
  assert.equal(emails, 0);

  const paidReplay = JSON.stringify({
    type: "payment.failed",
    data: { id: "pay_other", metadata: { orderId: "RL-ABC234" } },
  });
  const ignored = await receiveWhopWebhook(paidReplay, headers(paidReplay, "msg_3"), {
    secret,
    nowSeconds: now,
    applyPayment: async (reference, paymentId) => ({
      outcome: "paid" as const,
      transitioned: false,
      order: order(reference, "paid", paymentId),
    }),
    sendConfirmation: async () => {
      emails += 1;
    },
  });
  assert.equal(ignored.status, 200);
  assert.equal(emails, 0);
});

test("requires_action is acknowledged and does not settle", async () => {
  const payload = JSON.stringify({
    type: "payment.requires_action",
    data: { id: "pay_action1", metadata: { orderId: "RL-ABC234" } },
  });
  let applied = 0;
  const result = await receiveWhopWebhook(payload, headers(payload), {
    secret,
    nowSeconds: now,
    applyPayment: async () => {
      applied += 1;
      throw new Error("should not settle");
    },
  });
  assert.equal(result.status, 200);
  assert.equal(applied, 0);
});

test("a bad signature is 401 and a missing secret is 503", async () => {
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_testpayment1", metadata: { orderId: "RL-ABC234" } },
  });
  const bad = await receiveWhopWebhook(payload, { ...headers(payload), "webhook-signature": "v1,bm90aXQ" }, {
    secret,
    nowSeconds: now,
  });
  assert.equal(bad.status, 401);
  const missing = await receiveWhopWebhook(payload, headers(payload), { secret: "  " });
  assert.equal(missing.status, 503);
});

test("the same Whop payment id does not pay the order twice", async () => {
  const row = {
    reference: "RL-ABC234",
    status: "pending",
    payment_method: "whop",
    whop_payment_id: null as string | null,
    currency: "aud",
    subtotal_cents: 34000,
    total_cents: 30600,
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
  };
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("CREATE") || query.startsWith("SELECT column")) return [];
      const reference = String(params?.[0] ?? "");
      const paymentId = String(params?.[1] ?? "");
      if (query.includes("status = 'paid'")) {
        const open = row.status === "pending" || row.status === "awaiting_payment" || row.status === "failed";
        const idOk = row.whop_payment_id === null || row.whop_payment_id === paymentId || row.status === "failed";
        if (row.reference === reference && row.payment_method === "whop" && open && idOk) {
          row.status = "paid";
          row.whop_payment_id = paymentId;
          return [{ ...row }];
        }
        return [];
      }
      if (query.includes("status = 'failed'")) {
        const open = row.status === "pending" || row.status === "awaiting_payment";
        const idOk = row.whop_payment_id === null || row.whop_payment_id === paymentId;
        if (row.reference === reference && row.payment_method === "whop" && open && idOk) {
          row.status = "failed";
          row.whop_payment_id = paymentId;
          return [{ ...row }];
        }
        return [];
      }
      if (query.startsWith("SELECT")) return [{ ...row }];
      return [];
    },
  };

  const first = await applyWhopPayment("RL-ABC234", "pay_onceonly", "paid", sql);
  const replay = await applyWhopPayment("RL-ABC234", "pay_onceonly", "paid", sql);
  assert.equal(first.outcome, "paid");
  assert.equal(first.transitioned, true);
  assert.equal(replay.outcome, "paid");
  assert.equal(replay.transitioned, false);
  assert.equal(row.status, "paid");
  assert.equal(row.whop_payment_id, "pay_onceonly");
});
