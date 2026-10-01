import assert from "node:assert/strict";
import test from "node:test";
import { moneyToCents, parseWhopWebhook } from "./whop-event.ts";

test("payment.succeeded reads orderId and the charged total, not the fee remainder", () => {
  const parsed = parseWhopWebhook({
    type: "payment.succeeded",
    data: {
      id: "pay_abc123",
      currency: "aud",
      amount_after_fees: { amount: "9.71", currency: "aud", decimals: 2 },
      total: { amount: "180.00", currency: "aud", decimals: 2, display_decimals: 2 },
      metadata: { orderId: "RL-7F3K2Q" },
    },
  });
  assert.equal(parsed.kind, "payment");
  if (parsed.kind !== "payment") return;
  assert.equal(parsed.notice.type, "payment.succeeded");
  assert.equal(parsed.notice.paymentId, "pay_abc123");
  assert.equal(parsed.notice.orderId, "RL-7F3K2Q");
  assert.equal(parsed.notice.amountCents, 18000);
  assert.equal(parsed.notice.currency, "aud");
  assert.deepEqual(moneyToCents({ amount: "19.95", currency: "aud", decimals: 2 }), {
    cents: 1995,
    currency: "aud",
  });
});

test("payment.failed and payment.requires_action are recognised", () => {
  const failed = parseWhopWebhook({
    type: "payment.failed",
    data: { id: "pay_fail1", metadata: { order_id: "RL-7F3K2Q" } },
  });
  assert.equal(failed.kind, "payment");
  if (failed.kind === "payment") assert.equal(failed.notice.type, "payment.failed");

  const action = parseWhopWebhook({
    type: "payment.requires_action",
    data: {
      id: "pay_3ds",
      metadata: { orderId: "RL-7F3K2Q" },
      next_action: { type: "redirect" },
    },
  });
  assert.deepEqual(action, {
    kind: "requires_action",
    paymentId: "pay_3ds",
    orderId: "RL-7F3K2Q",
    nextAction: "redirect",
  });
});

test("events without a payment id or order id are ignored", () => {
  assert.deepEqual(parseWhopWebhook({ type: "payment.succeeded", data: { id: "pay_x" } }), {
    kind: "ignore",
  });
  assert.deepEqual(parseWhopWebhook({ type: "membership.activated", data: {} }), { kind: "ignore" });
});
