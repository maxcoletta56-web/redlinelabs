import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  centsToAudAmount,
  paymentAmountCents,
  readWhopPaymentEvent,
  unwrapWhopWebhook,
  whopApiBase,
  whopCheckoutConfigurationBody,
  whopEnvironment,
} from "./whop.ts";

const KEY = `ws_${"3f2a".repeat(16)}`;

function signature(payload: string, key: string, id: string, timestamp: string) {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
}

test("sandbox is the default Whop environment", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENV: "sandbox" }), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENV: "production" }), "production");
  assert.equal(whopApiBase("sandbox"), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBase("production"), "https://api.whop.com/api/v1");
});

test("inline pricing is AUD and carries the order id", () => {
  const body = whopCheckoutConfigurationBody({
    companyId: "biz_test",
    reference: "RL-7F3K2Q",
    totalCents: 19_800,
    returnUrl: "https://shop.example/checkout/return/RL-7F3K2Q",
  });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.initial_price, 198);
  assert.equal(body.metadata.orderId, "RL-7F3K2Q");
  assert.equal(body.metadata.order_id, "RL-7F3K2Q");
  assert.deepEqual(body.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(centsToAudAmount(19_800), 198);
});

test("a webhook signed with the raw secret verifies", () => {
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_abc123", metadata: { orderId: "RL-7F3K2Q" }, total: 198, currency: "aud" },
  });
  const timestamp = "1700000000";
  const headers = {
    "webhook-id": "msg_test",
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature(payload, KEY, "msg_test", timestamp)}`,
  };
  const event = unwrapWhopWebhook(payload, headers, KEY, 1_700_000_000_000);
  assert.equal(readWhopPaymentEvent(event)?.paymentId, "pay_abc123");
  assert.equal(readWhopPaymentEvent(event)?.orderReference, "RL-7F3K2Q");
});

test("a whsec_ secret is used verbatim, prefix included", () => {
  const key = `whsec_${"9d4e".repeat(16)}`;
  const payload = '{"type":"payment.failed","data":{"id":"pay_fail1"}}';
  const timestamp = "1700000000";
  const headers = {
    "Webhook-Id": "msg_test",
    "Webhook-Timestamp": timestamp,
    "Webhook-Signature": `v1,${signature(payload, key, "msg_test", timestamp)}`,
  };
  assert.doesNotThrow(() => unwrapWhopWebhook(payload, headers, key, 1_700_000_000_000));
  assert.throws(() => unwrapWhopWebhook(payload, headers, key.slice("whsec_".length), 1_700_000_000_000));
});

test("a tampered body or a stale timestamp is rejected", () => {
  const payload = '{"ok":true}';
  const timestamp = "1700000000";
  const headers = {
    "webhook-id": "msg_test",
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature(payload, KEY, "msg_test", timestamp)}`,
  };
  assert.throws(() => unwrapWhopWebhook(`${payload} `, headers, KEY, 1_700_000_000_000));
  assert.throws(() => unwrapWhopWebhook(payload, headers, KEY, 1_700_000_000_000 + 11 * 60 * 1000));
});

test("fee-adjusted amounts are not treated as the charge", () => {
  assert.equal(paymentAmountCents({ amount_after_fees: 9.71, total: 10 }), 1000);
  assert.equal(paymentAmountCents({ amount_after_fees: 9.71 }), null);
});
