import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import {
  createBankTransferOrder,
  normalizeShipping,
  type BankTransferShippingInput,
} from "./bank-transfer-checkout.ts";
import type { OrderCreatedNotice } from "./mailer.ts";

const goodAddress: BankTransferShippingInput = {
  name: "  Ada Lovelace  ",
  line1: "  1 Laboratory Road  ",
  line2: "  Unit 2  ",
  city: "  Sydney  ",
  state: " NSW ",
  postal_code: " 2000 ",
  country: " au ",
};

function payIdEnv() {
  const previous = {
    PAYID_ADDRESS: process.env.PAYID_ADDRESS,
    PAYID_ACCOUNT_NAME: process.env.PAYID_ACCOUNT_NAME,
  };
  process.env.PAYID_ADDRESS = "pay@example.com";
  process.env.PAYID_ACCOUNT_NAME = "Redline Labs";
  return () => {
    if (previous.PAYID_ADDRESS === undefined) delete process.env.PAYID_ADDRESS;
    else process.env.PAYID_ADDRESS = previous.PAYID_ADDRESS;
    if (previous.PAYID_ACCOUNT_NAME === undefined) delete process.env.PAYID_ACCOUNT_NAME;
    else process.env.PAYID_ACCOUNT_NAME = previous.PAYID_ACCOUNT_NAME;
  };
}

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

const orderInput = {
  items: [{ slug: "bpc-157", option: "10", qty: 1 }],
  email: " Ada@Example.com ",
  firstName: "Ada",
  lastName: "Lovelace",
  ageConfirmed: true,
  researchUse: true,
};

test("normalizeShipping rejects a missing or invalid Australian address", () => {
  assert.equal(normalizeShipping(null), null);
  assert.equal(normalizeShipping({ ...goodAddress, line1: "   " }), null);
  assert.equal(normalizeShipping({ ...goodAddress, city: "" }), null);
  assert.equal(normalizeShipping({ ...goodAddress, state: "   " }), null);
  assert.equal(normalizeShipping({ ...goodAddress, postal_code: "12" }), null);
  assert.equal(normalizeShipping({ ...goodAddress, postal_code: "abcd" }), null);
});

test("normalizeShipping trims and caps a valid Australian address", () => {
  const long = "x".repeat(250);
  const normalized = normalizeShipping({
    ...goodAddress,
    name: ` ${"n".repeat(150)} `,
    line1: ` ${long} `,
    line2: long,
    city: ` ${"c".repeat(150)} `,
  });
  assert.ok(normalized);
  assert.equal(normalized?.name.length, 120);
  assert.equal(normalized?.line1.length, 200);
  assert.equal(normalized?.line2.length, 200);
  assert.equal(normalized?.city.length, 120);
  assert.equal(normalized?.state, "NSW");
  assert.equal(normalized?.postcode, "2000");
  assert.equal(normalized?.country, "AU");
  assert.equal(normalized?.line1.startsWith("x"), true);
});

test("createBankTransferOrder refuses to insert when no address is supplied", async () => {
  const restore = payIdEnv();
  const { calls, sql } = recorder();
  try {
    await assert.rejects(
      () =>
        createBankTransferOrder(
          { ...orderInput, shipping: null },
          { sql, deliver: async () => undefined },
        ),
      /A shipping address is required/,
    );
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test("createBankTransferOrder stores a trimmed address and still succeeds if mail throws", async () => {
  const restore = payIdEnv();
  const { calls, sql } = recorder();
  let mailed: OrderCreatedNotice | null = null;
  try {
    const created = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress },
      {
        sql,
        deliver: async (notice) => {
          mailed = notice;
        },
      },
    );
    assert.match(created.reference, /^RL-[A-Z2-9]{6}$/);
    assert.equal(created.redirectUrl, `/order/${created.reference}`);
    assert.equal(created.totalCents, 8900);
    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    assert.equal(insert?.params?.[1], "awaiting_payment");
    const stored = JSON.parse(String(insert?.params?.[10])) as { line1: string; postcode: string };
    assert.equal(stored.line1, "1 Laboratory Road");
    assert.equal(stored.postcode, "2000");
    assert.equal(mailed?.shipping?.line1, "1 Laboratory Road");
    assert.equal(mailed?.shipping?.city, "Sydney");
    assert.equal(mailed?.email, "ada@example.com");

    const failedMail = recorder();
    const stillCreated = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress },
      {
        sql: failedMail.sql,
        deliver: async () => {
          throw new Error("smtp down");
        },
      },
    );
    assert.match(stillCreated.reference, /^RL-[A-Z2-9]{6}$/);
    assert.equal(
      failedMail.calls.some((call) => call.query.startsWith("INSERT")),
      true,
    );
  } finally {
    restore();
  }
});
