import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  audMajorUnits,
  buildCheckoutConfigurationBody,
  majorUnitsToCents,
  parseWhopWebhookEvent,
  readCheckoutConfiguration,
  verifyWhopWebhook,
  whopApiBase,
  whopEnvironment,
  whopOrderIdFromMetadata,
  whopPaymentAmountCents,
} from "./whop.ts";

test("card checkout stays in the sandbox until WHOP_ENV is live", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENV: "sandbox" }), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENV: "live" }), "production");
  assert.equal(whopApiBase("sandbox"), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBase("production"), "https://api.whop.com/api/v1");
});

test("inline pricing is AUD major units with the order id in metadata", () => {
  assert.equal(audMajorUnits(18000), 180);
  assert.equal(audMajorUnits(1999), 19.99);
  const body = buildCheckoutConfigurationBody({
    orderId: "RL-7F3K2Q",
    amountCents: 18000,
    redirectUrl: "https://example.test/checkout/return?order=RL-7F3K2Q",
    companyId: "biz_test",
  });
  assert.equal(body.mode, "payment");
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.company_id, "biz_test");
  assert.equal(body.plan.adaptive_pricing_enabled, false);
  assert.equal(
    readCheckoutConfiguration({ id: "ch_abc123", plan: { id: "plan_abc123" } })?.planId,
    "plan_abc123",
  );
  assert.equal(readCheckoutConfiguration({ id: "not-a-session", plan: { id: "plan_abc" } }), null);
});

test("webhook signatures accept whsec and ws secrets and reject replays", () => {
  const body = JSON.stringify({
    id: "msg_123",
    type: "payment.succeeded",
    data: { id: "pay_abc12345", metadata: { orderId: "RL-7F3K2Q" }, currency: "aud", total: 180 },
  });
  const timestamp = "1700000000";
  const id = "msg_123";
  const rawKey = Buffer.from("test-secret-key");
  const secret = `whsec_${rawKey.toString("base64")}`;
  const signature = createHmac("sha256", rawKey).update(`${id}.${timestamp}.${body}`).digest("base64");
  const now = 1_700_000_000_000;
  assert.equal(
    verifyWhopWebhook({
      secret,
      body,
      id,
      timestamp,
      signature: `v1,${signature}`,
      now,
    }),
    true,
  );

  const wsSecret = "ws_test_secret";
  const wsSignature = createHmac("sha256", Buffer.from(wsSecret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  assert.equal(
    verifyWhopWebhook({
      secret: wsSecret,
      body,
      id,
      timestamp,
      signature: `v1,${wsSignature}`,
      now,
    }),
    true,
  );
  assert.equal(
    verifyWhopWebhook({
      secret,
      body: `${body} `,
      id,
      timestamp,
      signature: `v1,${signature}`,
      now,
    }),
    false,
  );
  assert.equal(
    verifyWhopWebhook({
      secret,
      body,
      id,
      timestamp,
      signature: `v1,${signature}`,
      now: now + 6 * 60 * 1000,
    }),
    false,
  );
});

test("payment events expose orderId and the AUD amount in cents", () => {
  const body = JSON.stringify({
    type: "payment.succeeded",
    data: {
      id: "pay_abc12345",
      currency: "aud",
      total: 180,
      metadata: { orderId: "RL-7F3K2Q" },
    },
  });
  const event = parseWhopWebhookEvent(body);
  assert.equal(event?.type, "payment.succeeded");
  assert.equal(whopOrderIdFromMetadata(event?.data ?? {}), "RL-7F3K2Q");
  assert.equal(whopPaymentAmountCents(event?.data ?? {}), 18000);
  assert.equal(majorUnitsToCents("19.99"), 1999);
  assert.equal(parseWhopWebhookEvent("not-json"), null);
});
