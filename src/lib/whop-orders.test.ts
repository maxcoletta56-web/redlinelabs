import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { applyWhopPaymentNotice } from "./whop-orders.ts";
import type { WhopPaymentNotice } from "./whop.ts";

type OrderState = {
  reference: string;
  status: string;
  paymentMethod: string;
  totalCents: number;
  currency: string;
  whopPaymentId: string | null;
};

function memory(initial: OrderState) {
  let order = { ...initial };
  const receipts = new Map<string, string>();
  const sql: Sql = {
    query: async (query, params = []) => {
      if (query.startsWith("CREATE") || query.startsWith("ALTER")) return [];
      if (query.startsWith("SELECT")) {
        return [
          {
            reference: order.reference,
            status: order.status,
            currency: order.currency,
            subtotal_cents: order.totalCents,
            total_cents: order.totalCents,
            promo_code: null,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            items: [],
            shipping: null,
            volume_discount_cents: 0,
            payment_method: order.paymentMethod,
            whop_checkout_id: "ch_session",
            whop_payment_id: order.whopPaymentId,
          },
        ];
      }
      if (query.includes("INSERT INTO whop_payment_receipts")) {
        const [paymentId, , outcome] = params as string[];
        if (receipts.has(paymentId)) return [];
        receipts.set(paymentId, outcome);
        return [{ payment_id: paymentId }];
      }
      if (query.includes("SET outcome = 'paid'")) {
        const [paymentId] = params as string[];
        if (receipts.get(paymentId) !== "failed") return [];
        receipts.set(paymentId, "paid");
        return [{ payment_id: paymentId }];
      }
      if (query.includes("whop_payment_id = $2")) {
        const [reference, paymentId] = params as string[];
        if (
          order.reference !== reference ||
          order.paymentMethod !== "card" ||
          (order.status !== "pending" && order.status !== "failed")
        ) {
          return [];
        }
        order = { ...order, status: "paid", whopPaymentId: paymentId };
        return [{ reference: order.reference, status: "paid", whop_payment_id: paymentId }];
      }
      if (query.includes("SET status = 'failed'")) {
        const [reference] = params as string[];
        if (order.reference !== reference || order.paymentMethod !== "card" || order.status !== "pending") {
          return [];
        }
        order = { ...order, status: "failed" };
        return [{ reference: order.reference, status: "failed" }];
      }
      throw new Error(`Unexpected query: ${query}`);
    },
  };
  return {
    sql,
    receipts,
    read: () => order,
  };
}

const paidNotice: WhopPaymentNotice = {
  type: "payment.succeeded",
  paymentId: "pay_abc12345",
  orderId: "RL-7F3K2Q",
  currency: "aud",
  total: 180,
};

function pendingCard() {
  return memory({
    reference: "RL-7F3K2Q",
    status: "pending",
    paymentMethod: "card",
    totalCents: 18_000,
    currency: "aud",
    whopPaymentId: null,
  });
}

test("payment.succeeded marks the matching card order paid once", async () => {
  const db = pendingCard();
  const first = await applyWhopPaymentNotice(paidNotice, db.sql);
  const second = await applyWhopPaymentNotice(paidNotice, db.sql);
  assert.equal(first.action, "paid");
  assert.equal(second.action, "duplicate");
  assert.equal(db.read().status, "paid");
  assert.equal(db.read().whopPaymentId, "pay_abc12345");
});

test("payment.failed marks a pending card order failed once", async () => {
  const db = pendingCard();
  const notice: WhopPaymentNotice = { ...paidNotice, type: "payment.failed" };
  const first = await applyWhopPaymentNotice(notice, db.sql);
  const second = await applyWhopPaymentNotice(notice, db.sql);
  assert.equal(first.action, "failed");
  assert.equal(second.action, "duplicate");
  assert.equal(db.read().status, "failed");
});

test("a later success for the same payment upgrades a failure and a failure cannot undo a payment", async () => {
  const failedFirst = pendingCard();
  await applyWhopPaymentNotice({ ...paidNotice, type: "payment.failed" }, failedFirst.sql);
  const upgraded = await applyWhopPaymentNotice(paidNotice, failedFirst.sql);
  assert.equal(upgraded.action, "paid");
  assert.equal(failedFirst.read().status, "paid");

  const paidFirst = pendingCard();
  await applyWhopPaymentNotice(paidNotice, paidFirst.sql);
  const downgrade = await applyWhopPaymentNotice({ ...paidNotice, type: "payment.failed" }, paidFirst.sql);
  assert.equal(downgrade.action, "ignored");
  assert.equal(paidFirst.read().status, "paid");
});

test("a succeeded webhook with the wrong amount does not mark the order paid", async () => {
  const db = pendingCard();
  const result = await applyWhopPaymentNotice({ ...paidNotice, total: 1 }, db.sql);
  assert.equal(result.action, "ignored");
  assert.equal(db.read().status, "pending");
  assert.equal(db.receipts.get("pay_abc12345"), "rejected");
});

test("bank transfer orders are not changed by a card webhook", async () => {
  const db = memory({
    reference: "RL-7F3K2Q",
    status: "awaiting_payment",
    paymentMethod: "bank_transfer",
    totalCents: 18_000,
    currency: "aud",
    whopPaymentId: null,
  });
  const result = await applyWhopPaymentNotice(paidNotice, db.sql);
  assert.equal(result.action, "ignored");
  assert.equal(db.read().status, "awaiting_payment");
});
