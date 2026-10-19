import assert from "node:assert/strict";
import test from "node:test";
import { signWhopWebhook, unwrapWhopWebhook, WhopSignatureError } from "./whop-signature.ts";

const secret = "ws_test_secret";
const now = 1_700_000_000;

test("a raw ws_ secret verifies the exact body", () => {
  const payload = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_abc234" } });
  const signature = signWhopWebhook(payload, secret, "msg_1", now);
  const event = unwrapWhopWebhook(
    payload,
    {
      "webhook-id": "msg_1",
      "webhook-timestamp": String(now),
      "webhook-signature": signature,
    },
    secret,
    now,
  );
  assert.equal((event as { type: string }).type, "payment.succeeded");
});

test("a changed body or a base64 treatment of the secret does not verify", () => {
  const payload = JSON.stringify({ type: "payment.succeeded" });
  const signature = signWhopWebhook(payload, secret, "msg_1", now);
  const headers = {
    "webhook-id": "msg_1",
    "webhook-timestamp": String(now),
    "webhook-signature": signature,
  };
  assert.throws(
    () => unwrapWhopWebhook(`${payload} `, headers, secret, now),
    WhopSignatureError,
  );
  const encoded = Buffer.from(secret, "utf8").toString("base64");
  assert.throws(
    () => unwrapWhopWebhook(payload, headers, encoded, now),
    WhopSignatureError,
  );
});

test("a timestamp outside five minutes is rejected", () => {
  const payload = "{}";
  const signature = signWhopWebhook(payload, secret, "msg_1", now);
  assert.throws(
    () =>
      unwrapWhopWebhook(
        payload,
        {
          "webhook-id": "msg_1",
          "webhook-timestamp": String(now),
          "webhook-signature": signature,
        },
        secret,
        now + 5 * 60 + 1,
      ),
    /too old/,
  );
});
