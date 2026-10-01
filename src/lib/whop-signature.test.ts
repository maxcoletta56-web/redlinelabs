import assert from "node:assert/strict";
import test from "node:test";
import { signWhopWebhook, verifyWhopWebhook, WhopSignatureError } from "./whop-signature.ts";

const secret = "ws_test_secret";

function signed(payload: string, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  const id = "msg_test";
  return {
    payload,
    timestamp,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": signWhopWebhook(payload, secret, id, timestamp),
    },
  };
}

test("a signed Whop webhook verifies and returns the raw JSON", () => {
  const payload = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_abc" } });
  const message = signed(payload);
  const event = verifyWhopWebhook(message.payload, message.headers, secret, message.timestamp * 1000);
  assert.deepEqual(event, { type: "payment.succeeded", data: { id: "pay_abc" } });
});

test("a changed body, a wrong secret, or a stale timestamp is rejected", () => {
  const message = signed(JSON.stringify({ type: "payment.succeeded" }));
  assert.throws(
    () => verifyWhopWebhook(`${message.payload} `, message.headers, secret, message.timestamp * 1000),
    WhopSignatureError,
  );
  assert.throws(
    () => verifyWhopWebhook(message.payload, message.headers, "ws_other", message.timestamp * 1000),
    WhopSignatureError,
  );
  assert.throws(
    () =>
      verifyWhopWebhook(
        message.payload,
        message.headers,
        secret,
        message.timestamp * 1000 + 10 * 60 * 1000,
      ),
    WhopSignatureError,
  );
  assert.throws(
    () => verifyWhopWebhook(message.payload, {}, secret),
    WhopSignatureError,
  );
});
