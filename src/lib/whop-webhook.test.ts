import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { unwrapWebhook, WebhookVerificationError } from "./whop-webhook.ts";

const KEY = `ws_${"3f2a".repeat(16)}`;
const PAYLOAD = '{"id":"msg_1","type":"payment.succeeded","data":{"id":"pay_123","metadata":{"orderId":"ord_abc"}}}';

function headers(payload = PAYLOAD, key = KEY, at = new Date()) {
  const id = "msg_2Xa9";
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

test("accepts a Whop standard-webhooks signature", () => {
  const event = unwrapWebhook(PAYLOAD, headers(), KEY);
  assert.equal(event.type, "payment.succeeded");
  assert.equal(event.data?.id, "pay_123");
  assert.equal(event.data?.metadata?.orderId, "ord_abc");
});

test("rejects a tampered body and a stale timestamp", () => {
  assert.throws(() => unwrapWebhook(PAYLOAD.replace("pay_123", "pay_999"), headers(), KEY), WebhookVerificationError);
  const stale = new Date(Date.now() - 10 * 60 * 1000);
  assert.throws(() => unwrapWebhook(PAYLOAD, headers(PAYLOAD, KEY, stale), KEY), WebhookVerificationError);
});
