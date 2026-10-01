import assert from "node:assert/strict";
import test from "node:test";
import {
  audDollarsFromCents,
  buildWhopCheckoutBody,
  readWhopCheckoutIds,
  whopApiBase,
  whopEnvironment,
  whopReturnUrl,
} from "./whop-plan.ts";

test("card checkout stays in sandbox until production is selected", () => {
  assert.equal(whopEnvironment(undefined), "sandbox");
  assert.equal(whopEnvironment("sandbox"), "sandbox");
  assert.equal(whopEnvironment(" PRODUCTION "), "production");
  assert.equal(whopApiBase("sandbox"), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBase("production"), "https://api.whop.com/api/v1");
});

test("the checkout configuration prices the server total in AUD and stores orderId", () => {
  assert.equal(audDollarsFromCents(1995), 19.95);
  const body = buildWhopCheckoutBody({
    companyId: "biz_test",
    orderId: "RL-7F3K2Q",
    totalCents: 18_000,
    returnUrl: "https://redlinelabs.shop/checkout?order=RL-7F3K2Q",
  });
  assert.equal(body.mode, "payment");
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.account_id, "biz_test");
  assert.equal(body.plan.account_id, "biz_test");
  assert.equal(body.plan.three_ds_level, "mandate_if_required");
  assert.equal(body.plan.force_create_new_plan, true);
  assert.equal("price" in body, false);
  assert.equal(
    whopReturnUrl("https://redlinelabs.shop/", "RL-7F3K2Q"),
    "https://redlinelabs.shop/checkout?order=RL-7F3K2Q",
  );
});

test("only a checkout session id and plan id are accepted from Whop", () => {
  assert.deepEqual(
    readWhopCheckoutIds({ id: "ch_abc", plan: { id: "plan_def" } }),
    { sessionId: "ch_abc", planId: "plan_def" },
  );
  assert.equal(readWhopCheckoutIds({ id: "https://evil.example", plan: { id: "plan_def" } }), null);
  assert.equal(readWhopCheckoutIds({ id: "ch_abc" }), null);
});
