import assert from "node:assert/strict";
import test from "node:test";
import { centsToAud, whopCheckoutPayload, whopCheckoutUrl, whopEnvironment } from "./whop-config.ts";

test("unset Whop environment stays in sandbox", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENVIRONMENT: "production" }), "production");
  assert.equal(whopCheckoutUrl("sandbox"), "https://sandbox-api.whop.com/api/v1/checkout_configurations");
});

test("checkout configuration prices the inline plan in AUD and attaches orderId", () => {
  const payload = whopCheckoutPayload({
    accountId: "biz_test",
    orderId: "RL-7F3K2Q",
    amountAud: centsToAud(22050),
    title: "Redline Labs order RL-7F3K2Q",
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-7F3K2Q",
  });
  assert.equal(payload.currency, "aud");
  assert.equal(payload.plan.currency, "aud");
  assert.equal(payload.plan.initial_price, 220.5);
  assert.equal(payload.plan.plan_type, "one_time");
  assert.deepEqual(payload.metadata, { orderId: "RL-7F3K2Q" });
  assert.deepEqual(payload.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(payload.plan.three_ds_level, "frictionless_if_required");
  assert.equal("price" in payload, false);
});
