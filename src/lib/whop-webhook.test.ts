import assert from "node:assert/strict";
import test from "node:test";
import {
  readWhopPaymentNotice,
  signWhopWebhook,
  verifyWhopWebhook,
} from "./whop-webhook.ts";

const SECRET = "ws_test_secret";
const NOW = Date.parse("2026-09-28T00:00:00Z");

function headers(raw: Record<string, string>) {
  return { get: (name: string) => raw[name] ?? null };
}

test("a signed payment.succeeded event verifies and exposes the order id", () => {
  const body = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_abc123", metadata: { orderId: "RL-7F3K2Q" } },
  });
  const signed = signWhopWebhook(body, SECRET, NOW);
  const payload = verifyWhopWebhook(body, headers(signed), SECRET, NOW);
  assert.deepEqual(readWhopPaymentNotice(payload), {
    type: "payment.succeeded",
    paymentId: "pay_abc123",
    orderId: "RL-7F3K2Q",
  });
});

test("a bad signature is rejected", () => {
  const body = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_abc123" } });
  const signed = signWhopWebhook(body, SECRET, NOW);
  signed["webhook-signature"] = "v1,not-the-signature";
  assert.throws(() => verifyWhopWebhook(body, headers(signed), SECRET, NOW), /Invalid webhook signature/);
});

test("an old timestamp is rejected", () => {
  const body = "{}";
  const signed = signWhopWebhook(body, SECRET, NOW - 10 * 60 * 1000);
  assert.throws(
    () => verifyWhopWebhook(body, headers(signed), SECRET, NOW),
    /tolerance/,
  );
});

test("payment.failed is read and unrelated events are ignored", () => {
  assert.deepEqual(
    readWhopPaymentNotice({
      type: "payment.failed",
      data: { id: "pay_failed1", metadata: { orderId: "RL-7F3K2Q" } },
    }),
    { type: "payment.failed", paymentId: "pay_failed1", orderId: "RL-7F3K2Q" },
  );
  assert.equal(readWhopPaymentNotice({ type: "membership.activated", data: { id: "pay_abc" } }), null);
  assert.equal(
    readWhopPaymentNotice({ type: "payment.succeeded", data: { id: "pay_abc", metadata: {} } }),
    null,
  );
});
