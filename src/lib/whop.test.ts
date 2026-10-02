import assert from "node:assert/strict";
import test from "node:test";
import {
  audDollarsFromCents,
  createWhopCheckoutConfiguration,
  readWhopCheckoutConfiguration,
  whopApiOrigin,
  whopCheckoutConfigurationBody,
  whopEnvironment,
} from "./whop.ts";

test("sandbox is the default Whop environment and uses the sandbox API", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENVIRONMENT: "production" }), "production");
  assert.equal(whopApiOrigin("sandbox"), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiOrigin("production"), "https://api.whop.com/api/v1");
});

test("inline checkout pricing is AUD dollars and carries the order id", () => {
  assert.equal(audDollarsFromCents(24030), 240.3);
  const body = whopCheckoutConfigurationBody({
    companyId: "biz_test",
    orderId: "RL-7F3K2Q",
    totalCents: 24030,
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-7F3K2Q",
  });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.adaptive_pricing_enabled, false);
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.redirect_url, "https://redlinelabs.shop/checkout/return/RL-7F3K2Q");
});

test("a checkout configuration response needs a session id and a plan id", () => {
  assert.equal(readWhopCheckoutConfiguration({ id: "ch_abc", plan: { id: "plan_xyz" } })?.sessionId, "ch_abc");
  assert.equal(readWhopCheckoutConfiguration({ id: "not-a-session", plan: { id: "plan_xyz" } }), null);
  assert.equal(readWhopCheckoutConfiguration({ id: "ch_abc" }), null);
});

test("creating a configuration sends the server total and never the API key back", async () => {
  let captured: { url: string; authorization: string; body: unknown } | null = null;
  const session = await createWhopCheckoutConfiguration(
    {
      orderId: "RL-7F3K2Q",
      totalCents: 24030,
      returnUrl: "https://redlinelabs.shop/checkout/return/RL-7F3K2Q",
    },
    {
      env: {
        WHOP_API_KEY: "apikey_secret",
        WHOP_COMPANY_ID: "biz_test",
        WHOP_ENVIRONMENT: "sandbox",
      },
      fetchImpl: async (input, init) => {
        captured = {
          url: String(input),
          authorization: new Headers(init?.headers).get("authorization") ?? "",
          body: JSON.parse(String(init?.body)),
        };
        return new Response(JSON.stringify({ id: "ch_session1", plan: { id: "plan_inline1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  assert.equal(session.environment, "sandbox");
  assert.equal(session.sessionId, "ch_session1");
  assert.equal(session.planId, "plan_inline1");
  assert.equal(captured?.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  assert.equal(captured?.authorization, "Bearer apikey_secret");
  const body = captured?.body as { plan: { initial_price: number }; metadata: { orderId: string } };
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(body.metadata.orderId, "RL-7F3K2Q");
});
