import assert from "node:assert/strict";
import test from "node:test";
import { WhopSignatureError, signWhopWebhook, unwrapWhopWebhook } from "./whop-signature.ts";

const SECRET = "ws_test_secret";
const NOW = 1_700_000_000;

function headers(payload: string, overrides: Record<string, string> = {}) {
  const id = overrides["webhook-id"] ?? "msg_123";
  const timestamp = Number(overrides["webhook-timestamp"] ?? NOW);
  return {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": overrides["webhook-signature"] ?? signWhopWebhook(payload, SECRET, id, timestamp),
  };
}

test("a signed body verifies and returns the event", () => {
  const payload = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_123" } });
  const event = unwrapWhopWebhook(payload, headers(payload), SECRET, NOW) as { type: string };
  assert.equal(event.type, "payment.succeeded");
});

test("a second signature version still matches when one v1 value is valid", () => {
  const payload = '{"ok":true}';
  const signed = headers(payload);
  signed["webhook-signature"] = `v0,not-the-signature ${signed["webhook-signature"]}`;
  assert.deepEqual(unwrapWhopWebhook(payload, signed, SECRET, NOW), { ok: true });
});

test("a tampered body, a wrong secret, or a missing secret is rejected", () => {
  const payload = '{"type":"payment.succeeded"}';
  const signed = headers(payload);
  assert.throws(
    () => unwrapWhopWebhook(`${payload} `, signed, SECRET, NOW),
    WhopSignatureError,
  );
  assert.throws(
    () => unwrapWhopWebhook(payload, signed, "ws_other", NOW),
    /Invalid webhook signature/,
  );
  assert.throws(() => unwrapWhopWebhook(payload, signed, "  ", NOW), /without a key/);
  assert.throws(() => unwrapWhopWebhook(payload, {}, SECRET, NOW), /Missing webhook signature/);
});

test("timestamps outside five minutes are rejected", () => {
  const payload = "{}";
  const stale = headers(payload, { "webhook-timestamp": String(NOW - 5 * 60 - 1) });
  const future = headers(payload, { "webhook-timestamp": String(NOW + 5 * 60 + 1) });
  assert.throws(() => unwrapWhopWebhook(payload, stale, SECRET, NOW), /too old/);
  assert.throws(() => unwrapWhopWebhook(payload, future, SECRET, NOW), /too new/);
});
