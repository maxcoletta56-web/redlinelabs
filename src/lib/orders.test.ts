import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import {
  findOrder,
  insertOrder,
  listRecentOrders,
  markOrderPaid,
  markWhopOrderFailed,
  markWhopOrderPaid,
  readOrderRow,
  type NewOrder,
} from "./orders.ts";

type Call = { query: string; params?: unknown[] };

function recorder(handle: (call: Call) => unknown) {
  const calls: Call[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      const call = { query, params };
      calls.push(call);
      return handle(call) ?? [];
    },
  };
  return { calls, sql };
}

const order: NewOrder = {
  currency: "aud",
  subtotalCents: 20000,
  totalCents: 16000,
  promoCode: "DGC20",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  items: [
    {
      slug: "bpc-157",
      name: "BPC-157 (10mg)",
      option: "10mg",
      variantLabel: "Dose",
      sku: "RL-BPC-10",
      qty: 2,
      unitAmountCents: 10000,
    },
  ],
  shipping: null,
};

test("insert binds every order field as a parameter", async () => {
  const { calls, sql } = recorder((call) =>
    call.query.startsWith("INSERT") ? [{ reference: "ignored" }] : [],
  );
  const reference = await insertOrder(order, sql);

  assert.match(reference, /^RL-[A-Z2-9]{6}$/);
  assert.match(calls[0]?.query ?? "", /^CREATE TABLE IF NOT EXISTS orders/);
  const insert = calls[1];
  assert.match(insert?.query ?? "", /^INSERT INTO orders /);
  assert.match(insert?.query ?? "", /ON CONFLICT \(reference\) DO NOTHING/);
  assert.deepEqual(insert?.params, [
    reference,
    "awaiting_payment",
    "aud",
    20000,
    16000,
    "DGC20",
    "Ada",
    "Lovelace",
    "ada@example.com",
    JSON.stringify(order.items),
    null,
  ]);
});

test("insert retries with a new reference when one is already taken", async () => {
  let attempts = 0;
  const references: unknown[] = [];
  const { sql } = recorder((call) => {
    if (!call.query.startsWith("INSERT")) return [];
    attempts += 1;
    references.push(call.params?.[0]);
    return attempts < 3 ? [] : [{ reference: call.params?.[0] }];
  });

  const reference = await insertOrder(order, sql);
  assert.equal(attempts, 3);
  assert.equal(references.at(-1), reference);
});

test("insert gives up rather than looping forever", async () => {
  const { sql } = recorder(() => []);
  await assert.rejects(() => insertOrder(order, sql, 2), /allocate an order reference/);
});

test("insert without a database reports the missing configuration", async () => {
  await assert.rejects(() => insertOrder(order, null), /DATABASE_URL is not set/);
});

test("lookup rejects a reference that is not in the reference charset", async () => {
  const { calls, sql } = recorder(() => []);
  assert.equal(await findOrder("'; DROP TABLE orders; --", sql), null);
  assert.equal(await markOrderPaid("not-a-reference", sql), null);
  assert.equal(calls.length, 0);
});

test("lookup normalises the reference before binding it", async () => {
  const { calls, sql } = recorder((call) =>
    call.query.startsWith("SELECT") ? [{ reference: "RL-7F3K2Q", status: "awaiting_payment" }] : [],
  );
  const found = await findOrder("rl-7f3k2q", sql);
  assert.equal(found?.reference, "RL-7F3K2Q");
  assert.deepEqual(calls[1]?.params, ["RL-7F3K2Q"]);
});

test("marking paid is idempotent in SQL and returns the stored row", async () => {
  const { calls, sql } = recorder((call) =>
    call.query.startsWith("UPDATE")
      ? [{ reference: "RL-7F3K2Q", status: "paid", paid_at: "2026-09-27T01:02:03Z" }]
      : [],
  );
  const updated = await markOrderPaid("RL-7F3K2Q", sql);
  assert.match(calls[1]?.query ?? "", /paid_at = COALESCE\(paid_at, now\(\)\)/);
  assert.equal(updated?.status, "paid");
  assert.equal(updated?.paidAt, "2026-09-27T01:02:03Z");
});

test("listing caps the limit it sends to Postgres", async () => {
  const { calls, sql } = recorder(() => []);
  await listRecentOrders(10_000, sql);
  assert.deepEqual(calls[1]?.params, [200]);
  await listRecentOrders(0, sql);
  assert.deepEqual(calls[2]?.params, [1]);
});

test("rows with an unusable reference or status are not trusted", () => {
  assert.equal(readOrderRow(null), null);
  assert.equal(readOrderRow({ reference: "nope" }), null);
  assert.equal(
    readOrderRow({ reference: "RL-7F3K2Q", status: "refunded" })?.status,
    "awaiting_payment",
  );
});

test("item and shipping snapshots survive a jsonb round trip as text", () => {
  const row = readOrderRow({
    reference: "RL-7F3K2Q",
    status: "awaiting_payment",
    currency: "aud",
    subtotal_cents: "20000",
    total_cents: "16000",
    items: JSON.stringify(order.items),
    shipping: JSON.stringify({ line1: "1 Test St", city: "Sydney", state: "NSW" }),
  });
  assert.equal(row?.subtotalCents, 20000);
  assert.deepEqual(row?.items, order.items);
  assert.equal(row?.shipping?.line1, "1 Test St");
  assert.equal(row?.shipping?.country, "AU");
  assert.equal(row?.whopPaymentId, null);
});

test("a pending card order reads its status and Whop payment id", () => {
  const row = readOrderRow({
    reference: "RL-7F3K2Q",
    status: "pending",
    whop_payment_id: "pay_abc123",
  });
  assert.equal(row?.status, "pending");
  assert.equal(row?.whopPaymentId, "pay_abc123");
  assert.equal(readOrderRow({ reference: "RL-7F3K2Q", status: "failed" })?.status, "failed");
});

test("Whop paid update is limited to pending or failed card orders", async () => {
  const { calls, sql } = recorder((call) =>
    call.query.startsWith("UPDATE")
      ? [{ reference: "RL-7F3K2Q", status: "paid", whop_payment_id: "pay_abc123" }]
      : [],
  );
  const updated = await markWhopOrderPaid("RL-7F3K2Q", "pay_abc123", sql);
  assert.match(calls[1]?.query ?? "", /status = 'pending'/);
  assert.match(calls[1]?.query ?? "", /status = 'failed'/);
  assert.deepEqual(calls[1]?.params, ["RL-7F3K2Q", "pay_abc123"]);
  assert.equal(updated?.status, "paid");
  assert.equal(updated?.whopPaymentId, "pay_abc123");
  assert.equal(await markWhopOrderPaid("RL-7F3K2Q", "not-a-payment", sql), null);
});

test("Whop failed update does not touch a paid order", async () => {
  const { calls, sql } = recorder(() => []);
  assert.equal(await markWhopOrderFailed("RL-7F3K2Q", "pay_abc123", sql), null);
  assert.match(calls[1]?.query ?? "", /status = 'pending'/);
  assert.doesNotMatch(calls[1]?.query ?? "", /status = 'paid'/);
});
