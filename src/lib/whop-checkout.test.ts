import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { createWhopCardCheckout } from "./whop-checkout.ts";

const address = {
  name: "Ada Lovelace",
  line1: "1 Laboratory Road",
  city: "Sydney",
  state: "NSW",
  postal_code: "2000",
  country: "AU",
};

function recorder() {
  const calls: { query: string; params?: unknown[] }[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      if (query.startsWith("INSERT")) return [{ reference: params?.[0] }];
      return [];
    },
  };
  return { calls, sql };
}

test("card checkout saves a pending order and sends the server total to Whop sandbox", async () => {
  const previous = {
    WHOP_API_KEY: process.env.WHOP_API_KEY,
    WHOP_COMPANY_ID: process.env.WHOP_COMPANY_ID,
    WHOP_ENV: process.env.WHOP_ENV,
  };
  process.env.WHOP_API_KEY = "apik_sandbox_test";
  process.env.WHOP_COMPANY_ID = "biz_sandbox";
  delete process.env.WHOP_ENV;
  const { calls, sql } = recorder();
  let requestUrl = "";
  let requestBody = "";
  let authorization = "";
  try {
    const created = await createWhopCardCheckout(
      {
        items: [{ slug: "bpc-157", option: "10", qty: 3 }],
        email: "Ada@Example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        shipping: address,
        ageConfirmed: true,
        researchUse: true,
      },
      {
        sql,
        fetchImpl: async (input, init) => {
          requestUrl = String(input);
          authorization = new Headers(init?.headers).get("authorization") ?? "";
          requestBody = String(init?.body ?? "");
          return new Response(
            JSON.stringify({ id: "ch_sandbox_123", plan: { id: "plan_sandbox_123" } }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    );
    assert.equal(created.environment, "sandbox");
    assert.equal(created.sessionId, "ch_sandbox_123");
    assert.equal(created.planId, "plan_sandbox_123");
    assert.equal(created.totalCents, 24030);
    assert.match(created.returnUrl, /\/checkout\/return\/RL-[A-Z2-9]{6}$/);
    assert.match(requestUrl, /^https:\/\/sandbox-api\.whop\.com\/api\/v1\/checkout_configurations$/);
    assert.equal(authorization, "Bearer apik_sandbox_test");
    const body = JSON.parse(requestBody) as {
      currency: string;
      metadata: { orderId: string };
      plan: { currency: string; initial_price: number };
    };
    assert.equal(body.currency, "aud");
    assert.equal(body.plan.currency, "aud");
    assert.equal(body.plan.initial_price, 240.3);
    assert.equal(body.metadata.orderId, created.reference);
    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    assert.equal(insert?.params?.[2], 26700);
    assert.equal(insert?.params?.[3], 24030);
    assert.equal(insert?.params?.[10], "pending");
  } finally {
    if (previous.WHOP_API_KEY === undefined) delete process.env.WHOP_API_KEY;
    else process.env.WHOP_API_KEY = previous.WHOP_API_KEY;
    if (previous.WHOP_COMPANY_ID === undefined) delete process.env.WHOP_COMPANY_ID;
    else process.env.WHOP_COMPANY_ID = previous.WHOP_COMPANY_ID;
    if (previous.WHOP_ENV === undefined) delete process.env.WHOP_ENV;
    else process.env.WHOP_ENV = previous.WHOP_ENV;
  }
});
