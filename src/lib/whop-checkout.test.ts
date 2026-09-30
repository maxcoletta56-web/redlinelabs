import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { createWhopCardCheckout } from "./whop-checkout.ts";
import type { WhopConfig } from "./whop.ts";

const config: WhopConfig = {
  apiKey: "whop_test_key",
  companyId: "biz_testcompany",
  environment: "sandbox",
  apiBase: "https://sandbox-api.whop.com/api/v1",
};

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
      if (query.startsWith("INSERT INTO orders")) return [{ reference: params?.[0] }];
      return [];
    },
  };
  return { calls, sql };
}

test("card checkout prices from the catalogue, saves pending, and opens a sandbox session", async () => {
  const { calls, sql } = recorder();
  let requested: { url: string; body: Record<string, unknown>; authorization: string } | null = null;
  const created = await createWhopCardCheckout(
    {
      items: [{ slug: "bpc-157", option: "10", qty: 3 }],
      email: " Ada@Example.com ",
      firstName: "Ada",
      lastName: "Lovelace",
      shipping: address,
      promoCode: "DGC20",
      ageConfirmed: true,
      researchUse: true,
    },
    {
      sql,
      config,
      fetchImpl: async (input, init) => {
        requested = {
          url: String(input),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
          authorization: new Headers(init?.headers).get("authorization") ?? "",
        };
        return new Response(JSON.stringify({ id: "ch_sandbox123", plan: { id: "plan_sandbox123" } }), {
          status: 200,
        });
      },
    },
  );

  assert.equal(created.environment, "sandbox");
  assert.equal(created.totalCents, 19_224);
  assert.equal(created.sessionId, "ch_sandbox123");
  assert.equal(created.planId, "plan_sandbox123");
  assert.match(created.returnUrl, new RegExp(`/checkout/return/${created.reference}$`));

  const insert = calls.find((call) => call.query.startsWith("INSERT INTO orders"));
  assert.equal(insert?.params?.[1], "pending");
  assert.equal(insert?.params?.[4], 19_224);
  assert.equal(requested?.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  assert.equal(requested?.authorization, "Bearer whop_test_key");
  const plan = requested?.body.plan as { initial_price: number; currency: string };
  assert.equal(plan.currency, "aud");
  assert.equal(plan.initial_price, 192.24);
  assert.deepEqual(requested?.body.metadata, { orderId: created.reference });
  assert.equal(JSON.stringify(requested?.body).includes("whop_test_key"), false);
});

test("orders under $200 do not take the volume discount", async () => {
  const { sql } = recorder();
  let amount = 0;
  const created = await createWhopCardCheckout(
    {
      items: [{ slug: "bpc-157", option: "10", qty: 1 }],
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      shipping: address,
      ageConfirmed: true,
      researchUse: true,
    },
    {
      sql,
      config,
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as { plan: { initial_price: number } };
        amount = body.plan.initial_price;
        return new Response(JSON.stringify({ id: "ch_under200", plan: { id: "plan_under200" } }), {
          status: 200,
        });
      },
    },
  );
  assert.equal(created.totalCents, 8900);
  assert.equal(amount, 89);
});
