import assert from "node:assert/strict";
import test from "node:test";
import { audDollars, checkoutConfigurationBody, resolveWhop, whopApiOrigin } from "./whop-config.ts";
import { createCardCheckoutSession } from "./whop.ts";

test("defaults to the sandbox API and keeps the key server-side", () => {
  assert.equal(resolveWhop({}), undefined);
  assert.equal(resolveWhop({ WHOP_API_KEY: "sk_test" }), undefined);
  const resolved = resolveWhop({
    WHOP_API_KEY: "sk_test",
    WHOP_COMPANY_ID: "biz_123",
  });
  assert.equal(resolved?.environment, "sandbox");
  assert.equal(resolved?.apiOrigin, whopApiOrigin("sandbox"));
  assert.equal(
    resolveWhop({ WHOP_API_KEY: "sk_live", WHOP_COMPANY_ID: "biz_123", WHOP_ENV: "production" })
      ?.apiOrigin,
    "https://api.whop.com/api/v1",
  );
});

test("prices an inline AUD plan from the server total and attaches orderId", () => {
  assert.throws(() => audDollars(0), /greater than zero/);
  const body = checkoutConfigurationBody({
    companyId: "biz_123",
    orderId: "ord_aaaaaaaaaaaaaaaaaaaaaaaa",
    totalCents: 19800,
    redirectUrl: "https://redlinelabs.shop/checkout/return?orderId=ord_aaaaaaaaaaaaaaaaaaaaaaaa",
  });
  assert.equal(body.account_id, "biz_123");
  assert.equal(body.metadata.orderId, "ord_aaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 198);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.three_ds_level, "frictionless");
  assert.deepEqual(body.plan.payment_method_configuration, {
    enabled: ["card"],
    include_platform_defaults: false,
  });
  assert.equal(JSON.stringify(body).includes("sk_"), false);
});

test("reads the checkout configuration id and plan id", async () => {
  const session = await createCardCheckoutSession(
    { WHOP_API_KEY: "sk_test", WHOP_COMPANY_ID: "biz_123" },
    {
      orderId: "ord_aaaaaaaaaaaaaaaaaaaaaaaa",
      totalCents: 19800,
      returnUrl: "https://example.com/checkout/return",
    },
    async (url, init) => {
      assert.equal(url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer sk_test");
      const payload = JSON.parse(String(init?.body)) as { plan: { initial_price: number } };
      assert.equal(payload.plan.initial_price, 198);
      return new Response(
        JSON.stringify({ id: "ch_test", plan: { id: "plan_test" } }),
        { status: 200 },
      );
    },
  );
  assert.deepEqual(session, {
    planId: "plan_test",
    sessionId: "ch_test",
    environment: "sandbox",
  });
});
