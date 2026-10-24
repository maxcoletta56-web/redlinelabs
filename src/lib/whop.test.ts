import assert from "node:assert/strict";
import test from "node:test";
import {
  centsToAud,
  createWhopCheckoutConfiguration,
  whopApiBase,
  whopUsesSandbox,
} from "./whop.ts";

test("sandbox is the default and live is only WHOP_SANDBOX=false", () => {
  assert.equal(whopUsesSandbox({}), true);
  assert.equal(whopUsesSandbox({ WHOP_SANDBOX: "true" }), true);
  assert.equal(whopUsesSandbox({ WHOP_SANDBOX: " FALSE " }), false);
  assert.equal(whopApiBase({}), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBase({ WHOP_SANDBOX: "false" }), "https://api.whop.com/api/v1");
  assert.equal(centsToAud(20816), 208.16);
  assert.equal(centsToAud(1010), 10.1);
});

test("checkout configuration prices AUD from server cents and attaches orderId", async () => {
  let captured: {
    url: string;
    body: Record<string, unknown>;
    authorization: string | null;
    apiVersion: string | null;
  } | null = null;
  const result = await createWhopCheckoutConfiguration({
    orderId: "RL-ABC234",
    totalCents: 20816,
    returnUrl: "https://redlinelabs.shop/checkout/return?reference=RL-ABC234",
    env: { WHOP_API_KEY: "apik_test", WHOP_SANDBOX: "true", WHOP_COMPANY_ID: "biz_testco" },
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      captured = {
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        authorization: headers.get("Authorization"),
        apiVersion: headers.get("Api-Version-Date"),
      };
      return new Response(JSON.stringify({ id: "ch_testsession", plan: { id: "plan_testplan" } }), {
        status: 200,
      });
    },
  });

  assert.equal(result.id, "ch_testsession");
  assert.equal(result.planId, "plan_testplan");
  assert.ok(captured);
  assert.equal(captured.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  assert.equal(captured.authorization, "Bearer apik_test");
  assert.equal(captured.apiVersion, "2026-10-24");
  assert.equal(captured.body.mode, "payment");
  assert.deepEqual(captured.body.metadata, { orderId: "RL-ABC234" });
  assert.equal(captured.body.redirect_url, "https://redlinelabs.shop/checkout/return?reference=RL-ABC234");
  const plan = captured.body.plan as Record<string, unknown>;
  assert.equal(plan.currency, "aud");
  assert.equal(plan.initial_price, 208.16);
  assert.equal(plan.plan_type, "one_time");
  assert.equal(plan.three_ds_level, "mandate_if_required");
  assert.deepEqual(plan.metadata, { orderId: "RL-ABC234" });
  assert.equal(plan.account_id, "biz_testco");
  assert.equal("amount" in captured.body, false);
  assert.equal("price" in captured.body, false);
});

test("a checkout configuration without a ch_ id is refused", async () => {
  await assert.rejects(
    () =>
      createWhopCheckoutConfiguration({
        orderId: "RL-ABC234",
        totalCents: 1000,
        returnUrl: "https://redlinelabs.shop/checkout/return",
        env: { WHOP_API_KEY: "apik_test" },
        fetchImpl: async () => new Response(JSON.stringify({ id: "cs_notwhop" }), { status: 200 }),
      }),
    /checkout session/,
  );
});

test("card checkout refuses to run without an API key", async () => {
  await assert.rejects(
    () =>
      createWhopCheckoutConfiguration({
        orderId: "RL-ABC234",
        totalCents: 1000,
        returnUrl: "https://redlinelabs.shop/checkout/return",
        env: {},
        fetchImpl: async () => {
          throw new Error("fetch should not run");
        },
      }),
    /not configured/,
  );
});
