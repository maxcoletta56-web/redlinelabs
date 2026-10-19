import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { createWhopCardCheckout } from "./whop-checkout.ts";

const address = {
  name: "Ada Lovelace",
  line1: "1 Laboratory Road",
  line2: "",
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

test("card checkout stores a pending order at the catalogue total, including 10% over $200", async () => {
  const previous = process.env.WHOP_API_KEY;
  process.env.WHOP_API_KEY = "apik_test";
  const { calls, sql } = recorder();
  let charged: { orderId: string; totalCents: number } | null = null;
  try {
    const session = await createWhopCardCheckout(
      {
        items: [{ slug: "glow", option: "70", qty: 2 }],
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        shipping: address,
        ageConfirmed: true,
        researchUse: true,
      },
      {
        sql,
        createConfiguration: async (input) => {
          charged = { orderId: input.orderId, totalCents: input.totalCents };
          return { id: "ch_testsession", planId: "plan_testplan" };
        },
      },
    );
    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    assert.equal(insert?.params?.[1], "pending");
    assert.equal(insert?.params?.[4], 30_600);
    assert.equal(insert?.params?.[14], "whop");
    assert.equal(session.amountCents, 30_600);
    assert.equal(session.sessionId, "ch_testsession");
    assert.equal(charged?.totalCents, 30_600);
    assert.equal(charged?.orderId, session.reference);
    assert.match(session.returnUrl, /\/checkout\/return\?reference=/);
  } finally {
    if (previous === undefined) delete process.env.WHOP_API_KEY;
    else process.env.WHOP_API_KEY = previous;
  }
});
