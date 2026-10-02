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

function sqlRecorder() {
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

const env = {
  WHOP_API_KEY: "apikey_secret",
  WHOP_WEBHOOK_SECRET: "whsec_test",
  WHOP_COMPANY_ID: "biz_test",
  WHOP_ENVIRONMENT: "sandbox",
};

test("card checkout prices the catalogue, saves a pending order, and ignores a browser price", async () => {
  const { calls, sql } = sqlRecorder();
  let charged: number | null = null;
  const session = await createWhopCardCheckout(
    {
      items: [{ slug: "bpc-157", option: "10", qty: 3, price: 1 } as { slug: string; option: string; qty: number }],
      email: "Ada@Example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      shipping: address,
      ageConfirmed: true,
      researchUse: true,
    },
    {
      sql,
      env,
      returnUrlFor: (reference) => `https://shop.test/checkout/return/${reference}`,
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          metadata: { orderId: string };
          plan: { initial_price: number; currency: string };
        };
        charged = body.plan.initial_price;
        assert.equal(body.plan.currency, "aud");
        assert.equal(body.metadata.orderId.startsWith("RL-"), true);
        return new Response(JSON.stringify({ id: "ch_session1", plan: { id: "plan_inline1" } }), {
          status: 200,
        });
      },
    },
  );

  assert.equal(session.totalCents, 24030);
  assert.equal(charged, 240.3);
  assert.equal(session.environment, "sandbox");
  const insert = calls.find((call) => call.query.startsWith("INSERT INTO orders"));
  assert.equal(insert?.params?.[1], "pending");
  assert.equal(insert?.params?.[3], 26700);
  assert.equal(insert?.params?.[4], 24030);
  assert.equal(insert?.params?.[8], "ada@example.com");
});
