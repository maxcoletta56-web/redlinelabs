import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyWhopWebhook, WhopSignatureError } from "./whop-signature.ts";

const KEY = `ws_${"3f2a".repeat(16)}`;
const PAYLOAD = '{"id":"msg_123","type":"payment.succeeded","data":{"id":"pay_123"}}';

function signature(payload: string, key: string, id: string, timestamp: string) {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
}

function headers(overrides?: { payload?: string; key?: string; id?: string; timestamp?: string }) {
  const payload = overrides?.payload ?? PAYLOAD;
  const key = overrides?.key ?? KEY;
  const id = overrides?.id ?? "msg_2Xa9";
  const timestamp = overrides?.timestamp ?? "1700000000";
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature(payload, key, id, timestamp)}`,
  };
}

test("a valid Whop signature returns the parsed event", () => {
  const event = verifyWhopWebhook(PAYLOAD, headers(), KEY, 1700000000) as { data: { id: string } };
  assert.equal(event.data.id, "pay_123");
});

test("a tampered body or the wrong secret is rejected", () => {
  assert.throws(
    () => verifyWhopWebhook(PAYLOAD.replace("pay_123", "pay_456"), headers(), KEY, 1700000000),
    WhopSignatureError,
  );
  assert.throws(
    () => verifyWhopWebhook(PAYLOAD, headers({ key: "ws_other" }), KEY, 1700000000),
    WhopSignatureError,
  );
});

test("a stale timestamp is rejected", () => {
  assert.throws(
    () => verifyWhopWebhook(PAYLOAD, headers({ timestamp: "100" }), KEY, 1700000000),
    WhopSignatureError,
  );
});

test("a missing signing secret is reported separately from a bad signature", () => {
  assert.throws(
    () => verifyWhopWebhook(PAYLOAD, headers(), "  ", 1700000000),
    (error: unknown) => {
      assert.ok(error instanceof WhopSignatureError);
      assert.equal(error.code, "missing_key");
      return true;
    },
  );
  assert.throws(
    () => verifyWhopWebhook(PAYLOAD, headers({ key: "ws_other" }), KEY, 1700000000),
    (error: unknown) => {
      assert.ok(error instanceof WhopSignatureError);
      assert.equal(error.code, "invalid");
      return true;
    },
  );
});
