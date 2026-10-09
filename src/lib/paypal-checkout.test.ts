import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import {
  openPaypalCheckout,
  settleCapturedPaypalOrder,
  type PaypalCaptureInput,
} from "./paypal-checkout.ts";
import type { PaymentReceivedNotice, StoredOrder } from "./orders.ts";
import { buildPaypalOrder } from "./paypal.ts";

const paypalId = "5O190127TN364715T";

const shipping = {
  name: "Ada Lovelace",
  line1: "1 Laboratory Road",
  line2: "Unit 2",
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
      if (query.startsWith("INSERT") || query.startsWith("UPDATE")) {
        return [{ reference: params?.[0] }];
      }
      return [];
    },
  };
  return { calls, sql };
}

function stored(status: StoredOrder["status"], totalCents = 7120): StoredOrder {
  return {
    reference: "RL-7F3K2Q",
    status,
    currency: "aud",
    subtotalCents: 8900,
    totalCents,
    promoCode: "DGC20",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    clubEmail: null,
    clubPointsRedeemed: 0,
    clubDiscountCents: 0,
    paymentMethod: "paypal",
    paypalOrderId: paypalId,
    whopPaymentId: null,
    createdAt: "2026-10-07T00:00:00.000Z",
    paidAt: status === "paid" ? "2026-10-07T01:00:00.000Z" : null,
  };
}

function emailHooks(row: StoredOrder) {
  let current = row;
  const sent: PaymentReceivedNotice[] = [];
  const jobs: Promise<void>[] = [];
  const awards: string[] = [];
  let marked = 0;
  const hooks = {
    findOrder: async () => current,
    awardClubPoints: async (order: StoredOrder) => {
      awards.push(order.reference);
    },
    markOrderPaid: async () => {
      marked += 1;
      if (current.status !== "paid") {
        current = { ...current, status: "paid", paidAt: "2026-10-07T01:00:00.000Z" };
      }
      return current;
    },
    scheduleEmail: (_reference: string, task: () => Promise<void>) => {
      jobs.push(task());
    },
    sendPaymentReceivedEmail: async (notice: PaymentReceivedNotice) => {
      sent.push(notice);
    },
  };
  return { hooks, sent, jobs, awards, marked: () => marked };
}

test("PayPal checkout inserts an unpaid order before redirecting", async () => {
  const { calls, sql } = recorder();
  let mailed = false;
  let remoteBody: ReturnType<typeof buildPaypalOrder> | null = null;
  let insertedBeforeRemote = false;

  const placed = await openPaypalCheckout(
    {
      items: [{ slug: "bpc-157", option: "10", qty: 1 }],
      email: " Ada@Example.com ",
      firstName: "Ada",
      lastName: "Lovelace",
      shipping,
      promoCode: "dgc20",
      ageConfirmed: true,
      researchUse: true,
    },
    {
      sql,
      env: { PAYPAL_CLIENT_ID: "client", PAYPAL_CLIENT_SECRET: "secret" },
      siteUrl: (path) => `https://example.test${path}`,
      deliver: async (notice) => {
        mailed = notice.email === "ada@example.com" && notice.promoCode === "DGC20";
      },
      createRemoteOrder: async (_config, body) => {
        remoteBody = body;
        insertedBeforeRemote = calls.some((call) => call.query.startsWith("INSERT"));
        return {
          id: paypalId,
          approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${paypalId}`,
        };
      },
    },
  );

  const insert = calls.find((call) => call.query.startsWith("INSERT"));
  assert.equal(insertedBeforeRemote, true);
  assert.match(insert?.query ?? "", /'awaiting_payment'/);
  assert.equal(insert?.params?.[1], "aud");
  assert.equal(insert?.params?.[2], 8900);
  assert.equal(insert?.params?.[3], 7120);
  assert.equal(insert?.params?.[4], "DGC20");
  assert.equal(insert?.params?.[7], "ada@example.com");
  assert.equal(insert?.params?.[10], null);
  assert.equal(insert?.params?.[11], 0);
  assert.equal(insert?.params?.[12], 0);
  assert.equal(insert?.params?.[13], "paypal");
  assert.equal(insert?.params?.[14], null);
  const storedShipping = JSON.parse(String(insert?.params?.[9])) as { line1: string; postcode: string };
  assert.equal(storedShipping.line1, "1 Laboratory Road");
  assert.equal(storedShipping.postcode, "2000");
  assert.equal(mailed, true);
  assert.equal(remoteBody?.purchase_units[0]?.amount.value, "71.20");
  assert.equal(remoteBody?.purchase_units[0]?.amount.currency_code, "AUD");
  assert.match(remoteBody?.payment_source.paypal.experience_context.cancel_url ?? "", /paypal=cancelled/);

  const update = calls.find((call) => call.query.startsWith("UPDATE"));
  assert.deepEqual(update?.params, [placed.reference, paypalId]);
  assert.equal(placed.paypalOrderId, paypalId);
  assert.equal(placed.paymentMethod, "paypal");
  assert.equal(placed.totalCents, 7120);
  assert.match(placed.approvalUrl, /checkoutnow\?token=5O190127TN364715T/);
});

test("a completed PayPal capture marks the order paid once", async () => {
  const capture = emailHooks(stored("awaiting_payment"));
  const input: PaypalCaptureInput = {
    reference: "RL-7F3K2Q",
    paypalOrderId: paypalId,
    amountCents: 7120,
    currency: "AUD",
    captured: true,
  };

  const first = await settleCapturedPaypalOrder(input, capture.hooks);
  await Promise.all(capture.jobs);
  const second = await settleCapturedPaypalOrder(input, capture.hooks);
  await Promise.all(capture.jobs);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok) assert.equal(first.order.status, "paid");
  if (second.ok) assert.equal(second.alreadyPaid, true);
  assert.equal(capture.marked(), 2);
  assert.equal(capture.sent.length, 1);
  assert.equal(capture.sent[0]?.reference, "RL-7F3K2Q");
  assert.equal(capture.sent[0]?.totalCents, 7120);
  // Both captures ask for the award; the database makes the second a no-op.
  assert.deepEqual(capture.awards, ["RL-7F3K2Q", "RL-7F3K2Q"]);
});

test("a repeat PayPal capture re-asks for the award, which the database dedupes", async () => {
  const capture = emailHooks(stored("paid"));
  const settled = await settleCapturedPaypalOrder(
    {
      reference: "RL-7F3K2Q",
      paypalOrderId: paypalId,
      amountCents: 7120,
      currency: "AUD",
      captured: true,
    },
    capture.hooks,
  );
  assert.equal(settled.ok, true);
  if (settled.ok) assert.equal(settled.alreadyPaid, true);
  assert.deepEqual(capture.awards, ["RL-7F3K2Q"]);
});

test("a capture whose amount or currency does not match the order is refused", async () => {
  const wrongAmount = emailHooks(stored("awaiting_payment", 7120));
  const mismatch = await settleCapturedPaypalOrder(
    {
      reference: "RL-7F3K2Q",
      paypalOrderId: paypalId,
      amountCents: 100,
      currency: "AUD",
      captured: true,
    },
    wrongAmount.hooks,
  );
  assert.deepEqual(mismatch, { ok: false, reason: "amount_mismatch" });
  assert.equal(wrongAmount.marked(), 0);
  assert.equal(wrongAmount.sent.length, 0);

  const wrongCurrency = emailHooks(stored("awaiting_payment"));
  const currency = await settleCapturedPaypalOrder(
    {
      reference: "RL-7F3K2Q",
      paypalOrderId: paypalId,
      amountCents: 7120,
      currency: "USD",
      captured: true,
    },
    wrongCurrency.hooks,
  );
  assert.deepEqual(currency, { ok: false, reason: "amount_mismatch" });
  assert.equal(wrongCurrency.marked(), 0);
});
