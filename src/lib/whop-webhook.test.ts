import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  verifyAndReadWhopWebhook,
  webhookSecretBytes,
  WhopWebhookError,
} from "./whop-webhook.ts";

const secret = `whsec_${Buffer.from("test-secret-key-32bytes-long!!").toString("base64")}`;

function signed(body: string, timestamp: number, key = secret) {
  const id = "msg_test";
  const signature = createHmac("sha256", webhookSecretBytes(key))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}

const now = 1_700_000_000;

test("a signed payment.succeeded event exposes the payment id and orderId", () => {
  const body = JSON.stringify({
    id: "msg_test",
    type: "payment.succeeded",
    data: {
      id: "pay_abc123",
      metadata: { orderId: "RL-7F3K2Q" },
    },
  });
  const event = verifyAndReadWhopWebhook(body, signed(body, now), secret, now);
  assert.equal(event.type, "payment.succeeded");
  assert.equal(event.paymentId, "pay_abc123");
  assert.equal(event.orderId, "RL-7F3K2Q");
});

test("a tampered body or a stale timestamp is rejected", () => {
  const body = JSON.stringify({
    id: "msg_test",
    type: "payment.failed",
    data: { id: "pay_abc123", metadata: { orderId: "RL-7F3K2Q" } },
  });
  const headers = signed(body, now);
  assert.throws(
    () => verifyAndReadWhopWebhook(`${body} `, headers, secret, now),
    WhopWebhookError,
  );
  assert.throws(
    () => verifyAndReadWhopWebhook(body, headers, secret, now + 600),
    /tolerance/,
  );
});
