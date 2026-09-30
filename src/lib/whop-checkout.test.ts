import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { createWhopCardCheckout } from "./whop-checkout.ts";

const env = {
  WHOP_API_KEY: "apik_test",
  WHOP_WEBHOOK_SECRET: "ws_test",
  WHOP_COMPANY_ID: "biz_test",
  WHOP_ENV: "sandbox",
};

test("card checkout prices the catalogue on the server and ignores a browser price", async () => {
  const calls: { query: string; params?: unknown[] }[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      if (query.startsWith("INSERT")) return [{ reference: params?.[0] }];
      return [];
    },
  };
  let requested: { url: string; body: Record<string, unknown>; authorization: string } | null = null;
  const session = await createWhopCardCheckout(
    {
      items: [{ slug: "dsip", option: "15", qty: 2, price: 1 } as { slug: string; option: string; qty: number }],
      email: "Ada@Example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      shipping: {
        name: "Ada Lovelace",
        line1: "1 Research St",
        city: "Sydney",
        state: "NSW",
        postal_code: "2000",
        country: "AU",
      },
      ageConfirmed: true,
      researchUse: true,
    },
    {
      sql,
      env,
      origin: "http://127.0.0.1:3000",
      fetchImpl: async (input, init) => {
        requested = {
          url: String(input),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
          authorization: new Headers(init?.headers).get("authorization") ?? "",
        };
        return new Response(JSON.stringify({ id: "ch_testsession", plan: { id: "plan_testplan" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  const insert = calls.find((call) => call.query.startsWith("INSERT"));
  assert.equal(insert?.params?.[1], "pending");
  assert.equal(insert?.params?.[3], 22_000);
  assert.equal(insert?.params?.[4], 19_800);
  assert.equal(insert?.params?.[11], "card");
  assert.equal(session.amountCents, 19_800);
  assert.equal(session.environment, "sandbox");
  assert.equal(requested?.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  const plan = requested?.body.plan as { initial_price: number; currency: string };
  assert.equal(plan.initial_price, 198);
  assert.equal(plan.currency, "aud");
  assert.equal((requested?.body.metadata as { orderId: string }).orderId, session.reference);
  assert.equal(requested?.authorization, "Bearer apik_test");
  assert.match(session.returnUrl, /^http:\/\/127\.0\.0\.1:3000\/checkout\/return\/RL-/);
});
