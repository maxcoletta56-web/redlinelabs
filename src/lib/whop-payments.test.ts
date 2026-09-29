import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import type { StoredOrder } from "./orders.ts";
import { fulfillWhopPayment, type ConfirmationResult } from "./whop-payments.ts";

type PaymentRecord = {
  reference: string;
  outcome: "paid" | "failed";
  emailSent: boolean;
};

function memorySql(seed: StoredOrder) {
  const orders = new Map<string, StoredOrder>([[seed.reference, { ...seed }]]);
  const payments = new Map<string, PaymentRecord>();
  const sql: Sql = {
    query: async (query, params = []) => {
      if (query.startsWith("CREATE")) return [];
      if (query.startsWith("INSERT INTO whop_payments")) {
        const [paymentId, reference, outcome] = params as [string, string, "paid" | "failed"];
        if (payments.has(paymentId)) return [];
        payments.set(paymentId, { reference, outcome, emailSent: false });
        return [
          {
            payment_id: paymentId,
            order_reference: reference,
            outcome,
            email_sent: false,
          },
        ];
      }
      if (query.startsWith("SELECT payment_id")) {
        const row = payments.get(String(params[0]));
        if (!row) return [];
        return [
          {
            payment_id: params[0],
            order_reference: row.reference,
            outcome: row.outcome,
            email_sent: row.emailSent,
          },
        ];
      }
      if (query.includes("SET outcome = 'paid'")) {
        const row = payments.get(String(params[0]));
        if (!row || row.outcome !== "failed") return [];
        row.outcome = "paid";
        row.emailSent = false;
        return [{ payment_id: params[0] }];
      }
      if (query.includes("SET email_sent = true")) {
        const row = payments.get(String(params[0]));
        if (!row || row.outcome !== "paid" || row.emailSent) return [];
        row.emailSent = true;
        return [{ payment_id: params[0] }];
      }
      if (query.includes("SET email_sent = false")) {
        const row = payments.get(String(params[0]));
        if (row) row.emailSent = false;
        return [];
      }
      if (query.includes("SET status = 'paid'")) {
        const order = orders.get(String(params[0]));
        if (!order) return [];
        order.status = "paid";
        order.paidAt = order.paidAt ?? "2026-09-29T00:00:00Z";
        return [orderRow(order)];
      }
      if (query.includes("SET status = 'failed'")) {
        const order = orders.get(String(params[0]));
        if (!order || order.status !== "pending") return [];
        order.status = "failed";
        return [orderRow(order)];
      }
      if (query.startsWith("SELECT")) {
        const order = orders.get(String(params[0]));
        return order ? [orderRow(order)] : [];
      }
      return [];
    },
  };
  return { sql, orders, payments };
}

function orderRow(order: StoredOrder) {
  return {
    reference: order.reference,
    status: order.status,
    currency: order.currency,
    subtotal_cents: order.subtotalCents,
    total_cents: order.totalCents,
    promo_code: order.promoCode,
    first_name: order.firstName,
    last_name: order.lastName,
    email: order.email,
    items: order.items,
    shipping: order.shipping,
    created_at: order.createdAt,
    paid_at: order.paidAt,
  };
}

const order: StoredOrder = {
  reference: "RL-234567",
  status: "pending",
  currency: "aud",
  subtotalCents: 20_000,
  totalCents: 18_000,
  promoCode: null,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  items: [],
  shipping: null,
  createdAt: "2026-09-29T00:00:00Z",
  paidAt: null,
};

test("a successful payment is marked paid once and the email is not repeated", async () => {
  const store = memorySql(order);
  const sends: string[] = [];
  const send = async (): Promise<ConfirmationResult> => {
    sends.push("sent");
    return "sent";
  };
  const first = await fulfillWhopPayment({
    sql: store.sql,
    paymentId: "pay_1234",
    reference: order.reference,
    outcome: "paid",
    sendConfirmation: send,
  });
  const second = await fulfillWhopPayment({
    sql: store.sql,
    paymentId: "pay_1234",
    reference: order.reference,
    outcome: "paid",
    sendConfirmation: send,
  });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(sends, ["sent"]);
  assert.equal(store.orders.get(order.reference)?.status, "paid");
  assert.equal(store.payments.get("pay_1234")?.emailSent, true);
});

test("a failed payment marks the pending order failed and does not email", async () => {
  const store = memorySql(order);
  let emails = 0;
  const result = await fulfillWhopPayment({
    sql: store.sql,
    paymentId: "pay_fail",
    reference: order.reference,
    outcome: "failed",
    sendConfirmation: async () => {
      emails += 1;
      return "sent";
    },
  });
  assert.equal(result.status, 200);
  assert.equal(emails, 0);
  assert.equal(store.orders.get(order.reference)?.status, "failed");
});

test("a later failure for a payment that already succeeded does not unpay the order", async () => {
  const store = memorySql({ ...order, status: "paid", paidAt: "2026-09-29T00:00:00Z" });
  store.payments.set("pay_1234", {
    reference: order.reference,
    outcome: "paid",
    emailSent: true,
  });
  const result = await fulfillWhopPayment({
    sql: store.sql,
    paymentId: "pay_1234",
    reference: order.reference,
    outcome: "failed",
    sendConfirmation: async () => "sent",
  });
  assert.equal(result.status, 200);
  assert.equal(store.orders.get(order.reference)?.status, "paid");
});

test("an unsent confirmation is retried and a mail failure releases the claim", async () => {
  const store = memorySql(order);
  const failed = await fulfillWhopPayment({
    sql: store.sql,
    paymentId: "pay_mail",
    reference: order.reference,
    outcome: "paid",
    sendConfirmation: async () => "unconfigured",
  });
  assert.equal(failed.status, 500);
  assert.equal(store.payments.get("pay_mail")?.emailSent, false);
  assert.equal(store.orders.get(order.reference)?.status, "paid");

  const retried = await fulfillWhopPayment({
    sql: store.sql,
    paymentId: "pay_mail",
    reference: order.reference,
    outcome: "paid",
    sendConfirmation: async () => "sent",
  });
  assert.equal(retried.status, 200);
  assert.equal(store.payments.get("pay_mail")?.emailSent, true);
});
