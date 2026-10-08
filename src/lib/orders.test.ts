import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import {
  applyWhopPayment,
  findOrder,
  insertOrder,
  listRecentOrders,
  markOrderPaid,
  readOrderRow,
  whopChargeMatches,
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
    null,
    0,
    0,
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
  assert.equal(readOrderRow({ reference: "RL-7F3K2Q", status: "pending" })?.status, "pending");
  assert.equal(readOrderRow({ reference: "RL-7F3K2Q", status: "failed" })?.status, "failed");
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
});

test("the gross Whop amount must match the stored order", () => {
  const order = { totalCents: 18_000, currency: "aud" };
  assert.equal(whopChargeMatches(order, { currency: "aud", total: 180 }), true);
  assert.equal(whopChargeMatches(order, { currency: "AUD", total: null }), true);
  assert.equal(whopChargeMatches(order, { currency: "usd", total: 180 }), false);
  assert.equal(whopChargeMatches(order, { currency: "aud", total: 1 }), false);
});

test("the same Whop payment id marks an order paid once and does not email again", async () => {
  let status = "pending";
  let whopPaymentId: string | null = null;
  const sent: string[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("SELECT")) {
        return [
          {
            reference: "RL-7F3K2Q",
            status,
            currency: "aud",
            total_cents: 18000,
            email: "ada@example.com",
            first_name: "Ada",
            whop_payment_id: whopPaymentId,
          },
        ];
      }
      if (query.includes("whop_payment_id = $2") && query.includes("status = 'paid'")) {
        if (status === "paid") return [];
        status = "paid";
        whopPaymentId = String(params?.[1] ?? "");
        return [
          {
            reference: "RL-7F3K2Q",
            status: "paid",
            currency: "aud",
            total_cents: 18000,
            email: "ada@example.com",
            first_name: "Ada",
            whop_payment_id: whopPaymentId,
          },
        ];
      }
      return [];
    },
  };
  const hooks = {
    awardClubPoints: async () => null,
    scheduleEmail: (_reference: string, task: () => Promise<void>) => {
      void task();
    },
    sendPaymentReceivedEmail: async (notice: { reference: string }) => {
      sent.push(notice.reference);
    },
  };
  const first = await applyWhopPayment(
    { orderId: "RL-7F3K2Q", paymentId: "pay_abc", outcome: "succeeded", currency: "aud", total: 180 },
    sql,
    hooks,
  );
  const second = await applyWhopPayment(
    { orderId: "RL-7F3K2Q", paymentId: "pay_abc", outcome: "succeeded", currency: "aud", total: 180 },
    sql,
    hooks,
  );
  assert.equal(first.outcome, "paid");
  assert.equal(second.outcome, "already_done");
  assert.deepEqual(sent, ["RL-7F3K2Q"]);
});

test("a failed payment does not overwrite a paid order", async () => {
  const calls: string[] = [];
  const sql: Sql = {
    query: async (query) => {
      calls.push(query.slice(0, 24));
      if (query.startsWith("SELECT")) {
        return [{ reference: "RL-7F3K2Q", status: "paid", currency: "aud", total_cents: 18000 }];
      }
      return [{ reference: "RL-7F3K2Q", status: "failed" }];
    },
  };
  const result = await applyWhopPayment(
    { orderId: "RL-7F3K2Q", paymentId: "pay_fail", outcome: "failed" },
    sql,
  );
  assert.equal(result.outcome, "already_done");
  assert.equal(calls.some((query) => query.startsWith("UPDATE")), false);
});
