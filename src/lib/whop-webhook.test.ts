import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  handleWhopWebhook,
  parseWhopWebhook,
  verifyWhopWebhook,
  whopWebhookKeys,
} from "./whop-webhook.ts";

const NOW = Date.parse("2026-10-08T01:00:00.000Z");
const TIMESTAMP = String(Math.floor(NOW / 1000));

function sign(payload: string, key: Buffer | string, id = "msg_test") {
  const mac = createHmac("sha256", key).update(`${id}.${TIMESTAMP}.${payload}`).digest("base64");
  return { id, signature: `v1,${mac}` };
}

test("standard-webhooks secrets verify after the prefix is base64-decoded", () => {
  const rawKey = Buffer.from("redline-whop-test-key");
  const secret = `whsec_${rawKey.toString("base64")}`;
  const payload = JSON.stringify({
    id: "msg_test",
    type: "payment.succeeded",
    data: { id: "pay_abc", metadata: { orderId: "RL-7F3K2Q" }, currency: "aud", total: 180 },
  });
  const signed = sign(payload, whopWebhookKeys(secret)[0] ?? rawKey);
  assert.deepEqual(
    verifyWhopWebhook({
      payload,
      secret,
      nowMs: NOW,
      headers: {
        "webhook-id": signed.id,
        "webhook-timestamp": TIMESTAMP,
        "webhook-signature": signed.signature,
      },
    }),
    { ok: true },
  );
  assert.equal(
    verifyWhopWebhook({
      payload: `${payload} `,
      secret,
      nowMs: NOW,
      headers: {
        "webhook-id": signed.id,
        "webhook-timestamp": TIMESTAMP,
        "webhook-signature": signed.signature,
      },
    }).ok,
    false,
  );
});

test("a stale timestamp and a missing signature are rejected", () => {
  const payload = "{}";
  const secret = "whsec_dGVzdA==";
  assert.equal(
    verifyWhopWebhook({
      payload,
      secret,
      nowMs: NOW,
      headers: {
        "webhook-id": "msg_test",
        "webhook-timestamp": String(Math.floor(NOW / 1000) - 600),
        "webhook-signature": "v1,aaaa",
      },
    }).ok,
    false,
  );
  assert.equal(
    verifyWhopWebhook({
      payload,
      secret,
      nowMs: NOW,
      headers: { "webhook-id": "msg_test", "webhook-timestamp": TIMESTAMP },
    }).ok,
    false,
  );
});

test("payment.succeeded is settled once per delivery and failures are distinct", async () => {
  const secret = "whsec_dGVzdC1zZWNyZXQ=";
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_success", metadata: { orderId: "RL-7F3K2Q" }, currency: "aud", total: 180 },
  });
  const key = whopWebhookKeys(secret)[0];
  assert.ok(key);
  const signed = sign(payload, key);
  const seen: string[] = [];
  const headers = {
    "webhook-id": signed.id,
    "webhook-timestamp": TIMESTAMP,
    "webhook-signature": signed.signature,
  };
  const first = await handleWhopWebhook({
    raw: payload,
    headers,
    secret,
    nowMs: NOW,
    settle: async (event) => {
      seen.push(event.payment.id);
      return { outcome: "paid" };
    },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body && "outcome" in first.body ? first.body.outcome : "", "paid");
  assert.deepEqual(seen, ["pay_success"]);

  const forged = await handleWhopWebhook({
    raw: payload,
    headers: { ...headers, "webhook-signature": "v1,bm90LWEtcmVhbC1zaWduYXR1cmU=" },
    secret,
    nowMs: NOW,
    settle: async () => {
      throw new Error("must not settle");
    },
  });
  assert.equal(forged.status, 401);

  const ignored = await handleWhopWebhook({
    raw: JSON.stringify({ type: "membership.activated", data: {} }),
    headers: signHeaders(JSON.stringify({ type: "membership.activated", data: {} }), secret),
    secret,
    nowMs: NOW,
    settle: async () => {
      throw new Error("must not settle");
    },
  });
  assert.equal(ignored.status, 200);
});

function signHeaders(payload: string, secret: string) {
  const key = whopWebhookKeys(secret)[0];
  if (!key) throw new Error("missing key");
  const signed = sign(payload, key, "msg_other");
  return {
    "webhook-id": signed.id,
    "webhook-timestamp": TIMESTAMP,
    "webhook-signature": signed.signature,
  };
}

test("orderId is read from metadata and order_id is accepted", () => {
  const parsed = parseWhopWebhook(
    JSON.stringify({
      type: "payment.failed",
      data: { id: "pay_failed", metadata: { order_id: "RL-7F3K2Q" } },
    }),
  );
  assert.equal(parsed?.type, "payment.failed");
  assert.equal(parsed?.payment?.orderId, "RL-7F3K2Q");
  assert.equal(parsed?.payment?.id, "pay_failed");
});

test("an unsigned webhook is refused when the secret is missing", async () => {
  const result = await handleWhopWebhook({
    raw: "{}",
    headers: {},
    secret: "",
    settle: async () => ({ outcome: "paid" }),
  });
  assert.equal(result.status, 500);
});
