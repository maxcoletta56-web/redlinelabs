import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { createWhopCheckout } from "./whop-checkout.ts";
import { whopCheckoutConfigurationBody } from "./whop.ts";

const address = {
  name: "Ada Lovelace",
  line1: "1 Laboratory Road",
  city: "Sydney",
  state: "NSW",
  postal_code: "2000",
  country: "AU",
};

test("card checkout prices the catalogue on the server and opens a sandbox configuration", async () => {
  const calls: { query: string; params?: unknown[] }[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      if (query.startsWith("INSERT") || query.startsWith("UPDATE")) return [{ reference: params?.[0] }];
      return [];
    },
  };
  let sent: ReturnType<typeof whopCheckoutConfigurationBody> | null = null;
  const session = await createWhopCheckout(
    {
      items: [{ slug: "glow", option: "70", qty: 2 }],
      email: "Ada@Example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      shipping: address,
      ageConfirmed: true,
      researchUse: true,
    },
    {
      sql,
      env: { WHOP_API_KEY: "apik_sandbox", WHOP_WEBHOOK_SECRET: "ws_test" },
      siteUrl: (path) => `https://shop.test${path}`,
      createConfiguration: async (_config, body) => {
        sent = body;
        return { id: "ch_test", variant: { id: "plan_test" } };
      },
    },
  );

  const insert = calls.find((call) => call.query.startsWith("INSERT"));
  assert.equal(insert?.params?.[1], "pending");
  assert.equal(insert?.params?.[3], 34_000);
  assert.equal(insert?.params?.[4], 30_600);
  assert.equal(insert?.params?.[14], "whop");
  assert.equal(sent?.currency, "aud");
  assert.equal(sent?.variant.initial_price, 306);
  assert.equal(sent?.metadata.orderId, session.reference);
  assert.equal(sent?.variant.three_ds_level, "mandate_if_required");
  assert.equal(session.environment, "sandbox");
  assert.equal(session.planId, "plan_test");
  assert.equal(session.email, "ada@example.com");
  assert.match(session.returnUrl, /^https:\/\/shop\.test\/order\/RL-/);
});
