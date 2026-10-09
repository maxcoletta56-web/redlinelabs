import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import type { BankTransferShippingInput } from "./bank-transfer-checkout.ts";
import { absoluteUrl } from "./seo.ts";
import { WhopOrderSavedError, createWhopCardCheckout } from "./whop-checkout.ts";

const address: BankTransferShippingInput = {
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

function withWhopKey() {
  const previous = {
    WHOP_API_KEY: process.env.WHOP_API_KEY,
    WHOP_SANDBOX: process.env.WHOP_SANDBOX,
  };
  process.env.WHOP_API_KEY = "apik_test_secret";
  process.env.WHOP_SANDBOX = "true";
  return () => {
    if (previous.WHOP_API_KEY === undefined) delete process.env.WHOP_API_KEY;
    else process.env.WHOP_API_KEY = previous.WHOP_API_KEY;
    if (previous.WHOP_SANDBOX === undefined) delete process.env.WHOP_SANDBOX;
    else process.env.WHOP_SANDBOX = previous.WHOP_SANDBOX;
  };
}

test("card checkout stores a pending order at the catalogue total, ignoring a browser price", async () => {
  const restore = withWhopKey();
  const { calls, sql } = recorder();
  const priced: { orderId: string; totalCents: number; returnUrl: string }[] = [];
  const tampered = [{ slug: "bpc-157", option: "10", qty: 3, price: 1 }];
  try {
    const session = await createWhopCardCheckout(
      {
        items: tampered,
        email: " Ada@Example.com ",
        firstName: "Ada",
        lastName: "Lovelace",
        shipping: address,
        ageConfirmed: true,
        researchUse: true,
      },
      {
        sql,
        createConfiguration: async (input) => {
          priced.push(input);
          return { id: "ch_embed_session", planId: "plan_hidden" };
        },
      },
    );
    assert.equal(session.sessionId, "ch_embed_session");
    assert.equal(session.planId, "plan_hidden");
    assert.equal(session.environment, "sandbox");
    assert.equal(session.totalCents, 24030);
    assert.equal(session.returnUrl, absoluteUrl(`/order/${session.reference}`));
    assert.equal(priced[0]?.orderId, session.reference);
    assert.equal(priced[0]?.totalCents, 24030);
    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    assert.equal(insert?.params?.[13], "whop");
    assert.equal(insert?.params?.[15], "pending");
    assert.equal(insert?.params?.[3], 24030);
  } finally {
    restore();
  }
});

test("a promo is taken after the volume discount, and a Whop failure keeps the saved order", async () => {
  const restore = withWhopKey();
  const { calls, sql } = recorder();
  try {
    const session = await createWhopCardCheckout(
      {
        items: [{ slug: "bpc-157", option: "10", qty: 3 }],
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        shipping: address,
        promoCode: "DGC20",
        ageConfirmed: true,
        researchUse: true,
      },
      {
        sql,
        createConfiguration: async () => ({ id: "ch_promo_session", planId: null }),
      },
    );
    // 26700 catalogue, 10% volume → 24030, then 20% promo → 19224.
    assert.equal(session.totalCents, 19224);

    const failed = recorder();
    await assert.rejects(
      () =>
        createWhopCardCheckout(
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
            sql: failed.sql,
            createConfiguration: async () => {
              throw new Error("whop down");
            },
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof WhopOrderSavedError);
        assert.match(error.reference, /^RL-[A-Z2-9]{6}$/);
        return true;
      },
    );
    assert.equal(failed.calls.some((call) => call.query.startsWith("INSERT")), true);

    await assert.rejects(
      () =>
        createWhopCardCheckout(
          {
            items: [{ slug: "bpc-157", option: "10", qty: 1 }],
            email: "ada@example.com",
            shipping: null,
            ageConfirmed: true,
            researchUse: true,
          },
          { sql, createConfiguration: async () => ({ id: "ch_should_not_run", planId: null }) },
        ),
      /shipping address/,
    );
    assert.equal(calls.filter((call) => call.query.startsWith("INSERT")).length, 1);
  } finally {
    restore();
  }
});

test("card checkout does nothing when the API key is missing", async () => {
  const previous = process.env.WHOP_API_KEY;
  delete process.env.WHOP_API_KEY;
  const { calls, sql } = recorder();
  try {
    await assert.rejects(
      () =>
        createWhopCardCheckout(
          {
            items: [{ slug: "bpc-157", option: "10", qty: 1 }],
            email: "ada@example.com",
            shipping: address,
            ageConfirmed: true,
            researchUse: true,
          },
          { sql },
        ),
      /not configured/,
    );
    assert.equal(calls.length, 0);
  } finally {
    if (previous === undefined) delete process.env.WHOP_API_KEY;
    else process.env.WHOP_API_KEY = previous;
  }
});
