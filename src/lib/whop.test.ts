import assert from "node:assert/strict";
import test from "node:test";
import {
  audMajorUnits,
  createWhopCheckoutConfiguration,
  whopApiBase,
  whopCheckoutConfigurationBody,
  whopEnvironment,
  whopReturnOrigin,
  whopReturnUrl,
  whopSandbox,
} from "./whop.ts";

test("sandbox is the default API and element environment", () => {
  assert.equal(whopSandbox({}), true);
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopApiBase(true), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopSandbox({ WHOP_SANDBOX: "false" }), false);
  assert.equal(whopApiBase(false), "https://api.whop.com/api/v1");
});

test("checkout configuration prices in AUD from server cents and tags the order", () => {
  const body = whopCheckoutConfigurationBody({
    companyId: "biz_test",
    orderId: "RL-7F3K2Q",
    totalCents: 18_000,
  });
  assert.equal(body.currency, "aud");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.metadata.orderId, "RL-7F3K2Q");
  assert.equal(audMajorUnits(19_995), 199.95);
  assert.equal("price" in body, false);
});

test("the return URL stays on this site", () => {
  assert.equal(
    whopReturnOrigin({ get: () => "evil.example" }),
    "https://redlinelabs.shop",
  );
  assert.equal(
    whopReturnOrigin({ get: (name) => (name === "host" ? "localhost:3000" : null) }),
    "http://localhost:3000",
  );
  assert.equal(
    whopReturnUrl("http://localhost:3000", "RL-7F3K2Q"),
    "http://localhost:3000/checkout/return?reference=RL-7F3K2Q",
  );
});

test("creating a configuration sends the server total and keeps the API key on the request", async () => {
  let seen: { url: string; authorization: string; body: { plan: { initial_price: number }; metadata: { orderId: string } } } | null =
    null;
  const created = await createWhopCheckoutConfiguration(
    { orderId: "RL-7F3K2Q", totalCents: 18_000 },
    {
      env: { WHOP_API_KEY: "apik_test_secret", WHOP_COMPANY_ID: "biz_test", WHOP_SANDBOX: "true" },
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers);
        seen = {
          url: String(url),
          authorization: headers.get("authorization") ?? "",
          body: JSON.parse(String(init?.body)) as {
            plan: { initial_price: number };
            metadata: { orderId: string };
          },
        };
        return new Response(JSON.stringify({ id: "ch_testconfig" }), { status: 200 });
      },
    },
  );
  assert.equal(created.id, "ch_testconfig");
  assert.equal(created.environment, "sandbox");
  assert.equal(seen?.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  assert.equal(seen?.authorization, "Bearer apik_test_secret");
  assert.equal(seen?.body.plan.initial_price, 180);
  assert.equal(seen?.body.metadata.orderId, "RL-7F3K2Q");
});
