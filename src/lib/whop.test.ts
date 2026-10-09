import assert from "node:assert/strict";
import test from "node:test";
import {
  centsToAud,
  createWhopCheckoutConfiguration,
  whopApiBase,
  whopEnvironmentName,
  whopUsesSandbox,
} from "./whop.ts";

test("sandbox is the default API until WHOP_SANDBOX is false", () => {
  assert.equal(whopUsesSandbox({}), true);
  assert.equal(whopUsesSandbox({ WHOP_SANDBOX: "true" }), true);
  assert.equal(whopUsesSandbox({ WHOP_SANDBOX: " FALSE " }), false);
  assert.equal(whopEnvironmentName({}), "sandbox");
  assert.equal(whopEnvironmentName({ WHOP_SANDBOX: "false" }), "production");
  assert.equal(whopApiBase({}), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBase({ WHOP_SANDBOX: "false" }), "https://api.whop.com/api/v1");
});

test("AUD prices are major units, not cents", () => {
  assert.equal(centsToAud(24030), 240.3);
  assert.equal(centsToAud(18000), 180);
  assert.equal(centsToAud(1010), 10.1);
});

test("checkout configuration prices the order in AUD and attaches the order id", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const configuration = await createWhopCheckoutConfiguration({
    orderId: "RL-7F3K2Q",
    totalCents: 24030,
    returnUrl: "https://redlinelabs.shop/order/RL-7F3K2Q",
    env: { WHOP_API_KEY: "apik_test_secret", WHOP_SANDBOX: "true", WHOP_COMPANY_ID: "biz_test" },
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ id: "ch_testsession", plan: { id: "plan_testplan" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(configuration.id, "ch_testsession");
  assert.equal(configuration.planId, "plan_testplan");
  assert.ok(captured);
  assert.equal(captured.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  const headers = new Headers(captured.init.headers);
  assert.equal(headers.get("Authorization"), "Bearer apik_test_secret");
  assert.equal(headers.get("Idempotency-Key"), "whop-checkout-RL-7F3K2Q");
  assert.equal(headers.get("Api-Version-Date"), "2026-10-08");
  const body = JSON.parse(String(captured.init.body)) as {
    mode: string;
    metadata: { orderId: string };
    redirect_url: string;
    account_id: string;
    plan: {
      currency: string;
      initial_price: number;
      plan_type: string;
      release_method: string;
      visibility: string;
      force_create_new_plan: boolean;
      three_ds_level: string;
      account_id: string;
    };
  };
  assert.equal(body.mode, "payment");
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.redirect_url, "https://redlinelabs.shop/order/RL-7F3K2Q");
  assert.equal(body.account_id, "biz_test");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.release_method, "buy_now");
  assert.equal(body.plan.visibility, "hidden");
  assert.equal(body.plan.force_create_new_plan, true);
  assert.equal(body.plan.three_ds_level, "mandate_if_required");
  assert.equal(body.plan.account_id, "biz_test");
});

test("a live key is refused a sandbox host only when sandbox is explicitly off", async () => {
  let url = "";
  await createWhopCheckoutConfiguration({
    orderId: "RL-7F3K2Q",
    totalCents: 8900,
    returnUrl: "https://redlinelabs.shop/order/RL-7F3K2Q",
    env: { WHOP_API_KEY: "apik_live", WHOP_SANDBOX: "false" },
    fetchImpl: async (input) => {
      url = String(input);
      return new Response(JSON.stringify({ id: "ch_livesession" }), { status: 200 });
    },
  });
  assert.equal(url, "https://api.whop.com/api/v1/checkout_configurations");
});

test("a failed configuration or a missing session id is not treated as a checkout", async () => {
  await assert.rejects(
    () =>
      createWhopCheckoutConfiguration({
        orderId: "RL-7F3K2Q",
        totalCents: 8900,
        returnUrl: "https://redlinelabs.shop/order/RL-7F3K2Q",
        env: { WHOP_API_KEY: "apik_test" },
        fetchImpl: async () => new Response("no", { status: 422 }),
      }),
    /failed \(422\)/,
  );
  await assert.rejects(
    () =>
      createWhopCheckoutConfiguration({
        orderId: "RL-7F3K2Q",
        totalCents: 8900,
        returnUrl: "https://redlinelabs.shop/order/RL-7F3K2Q",
        env: { WHOP_API_KEY: "apik_test" },
        fetchImpl: async () => new Response(JSON.stringify({ id: "short" }), { status: 200 }),
      }),
    /checkout session/,
  );
});
