import assert from "node:assert/strict";
import test from "node:test";
import type { StoredOrder } from "./orders.ts";
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
