import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  centsToAudAmount,
  checkoutConfigurationBody,
  readCreatedCheckout,
  readPaymentEvent,
  resolveWhopConfig,
  verifyWhopWebhook,
  webhookSecretKeys,
  whopEnvironment,
  WhopSignatureError,
  type WhopConfig,
} from "./whop.ts";

const config: WhopConfig = {
  apiKey: "whop_test_key",
  companyId: "biz_testcompany",
  environment: "sandbox",
  apiBase: "https://sandbox-api.whop.com/api/v1",
};

test("card checkout stays in sandbox unless production is explicit", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENVIRONMENT: "sandbox" }), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENV: "" }), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENVIRONMENT: "production" }), "production");
  assert.equal(whopEnvironment({ WHOP_ENV: "live" }), "production");
  assert.equal(resolveWhopConfig({}), null);
  assert.equal(resolveWhopConfig({ WHOP_API_KEY: "secret", WHOP_COMPANY_ID: "biz_abc" })?.environment, "sandbox");
});

test("inline plan is priced in AUD from server cents and carries orderId", () => {
  const body = checkoutConfigurationBody(config, {
    orderId: "RL-7F3K2Q",
    amountCents: 24_030,
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-7F3K2Q",
    title: "Order RL-7F3K2Q",
  });
  assert.equal(body.mode, "payment");
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(body.plan.company_id, "biz_testcompany");
  assert.equal(body.plan.account_id, "biz_testcompany");
  assert.equal(body.plan.three_ds_level, "frictionless_if_required");
  assert.deepEqual(body.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(body.plan.payment_method_configuration.include_platform_defaults, false);
  assert.equal(body.plan.adaptive_pricing_enabled, false);
  assert.equal("price" in body, false);
  assert.equal(centsToAudAmount(8900), 89);
});

test("checkout configuration response must include a session and a plan", () => {
  assert.deepEqual(readCreatedCheckout({ id: "ch_abc123", plan: { id: "plan_xyz789" } }), {
    sessionId: "ch_abc123",
    planId: "plan_xyz789",
  });
  assert.equal(readCreatedCheckout({ id: "https://evil.example", plan: { id: "plan_xyz789" } }), null);
  assert.equal(readCreatedCheckout({ purchase_url: "https://whop.com/checkout/ch_abc" }), null);
});

function signed(secret: string | Buffer, body: string, timestamp: string, id = "msg_test") {
  const key = typeof secret === "string" ? Buffer.from(secret) : secret;
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return {
    id,
    timestamp,
    signature: `v1,${signature}`,
  };
}

test("webhook signatures accept a ws_ secret as raw bytes and a whsec_ secret as base64", () => {
  const body = JSON.stringify({ type: "payment.succeeded" });
  const now = 1_800_000_000_000;
  const timestamp = String(Math.floor(now / 1000));
  const sandboxSecret = "ws_sandbox_secret_value";
  verifyWhopWebhook(body, signed(sandboxSecret, body, timestamp), sandboxSecret, now);

  const raw = Buffer.from("production-webhook-secret");
  const standardSecret = `whsec_${raw.toString("base64")}`;
  verifyWhopWebhook(body, signed(raw, body, timestamp), standardSecret, now);
  assert.ok(webhookSecretKeys(standardSecret).some((key) => key.equals(raw)));
});

test("webhook signatures reject a bad signature, a stale timestamp, and a missing v1 signature", () => {
  const body = "{}";
  const now = 1_800_000_000_000;
  const timestamp = String(Math.floor(now / 1000));
  const headers = signed("ws_secret", body, timestamp);
  assert.throws(
    () => verifyWhopWebhook(body, { ...headers, signature: "v1,bm90LXRoZS1zaWduYXR1cmU=" }, "ws_secret", now),
    WhopSignatureError,
  );
  assert.throws(
    () => verifyWhopWebhook(body, signed("ws_secret", body, "1"), "ws_secret", now),
    /outside the allowed window/,
  );
  assert.throws(
    () => verifyWhopWebhook(body, { ...headers, signature: "v1a,abc" }, "ws_secret", now),
    /missing/,
  );
});

test("payment events keep the Whop payment id and the orderId metadata", () => {
  assert.deepEqual(
    readPaymentEvent({
      type: "payment.succeeded",
      data: { id: "pay_abc123", metadata: { orderId: "RL-7F3K2Q" } },
    }),
    { type: "payment.succeeded", paymentId: "pay_abc123", orderId: "RL-7F3K2Q" },
  );
  assert.equal(readPaymentEvent({ type: "payment.created", data: { id: "pay_abc123" } }), null);
  assert.equal(
    readPaymentEvent({ type: "payment.failed", data: { id: "not-a-payment", metadata: { orderId: "RL-7F3K2Q" } } }),
    null,
  );
});
