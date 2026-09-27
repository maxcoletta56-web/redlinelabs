import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { applyWhopPayment, readWhopPaymentNotice } from "./whop-webhook.ts";

type Payment = { outcome: string };

function memory() {
  const orders = new Map<string, Record<string, unknown>>();
  const payments = new Map<string, Payment>();
  orders.set("RL-7F3K2Q", {
    reference: "RL-7F3K2Q",
    status: "pending",
    currency: "aud",
    subtotal_cents: 20000,
    total_cents: 18000,
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    items: "[]",
  });
  const sql: Sql = {
    query: async (query, params = []) => {
      if (query.startsWith("CREATE")) return [];
      if (query.startsWith("SELECT") && query.includes("FROM orders")) {
        const order = orders.get(String(params[0]));
        return order ? [order] : [];
      }
      if (query.startsWith("UPDATE orders SET status = 'paid'")) {
        const order = orders.get(String(params[0]));
        if (!order) return [];
        order.status = "paid";
        order.paid_at = order.paid_at ?? "2026-09-27T01:02:03Z";
        return [order];
      }
      if (query.includes("status = 'failed'")) {
        const order = orders.get(String(params[0]));
        if (!order || (order.status !== "pending" && order.status !== "failed")) return [];
        order.status = "failed";
        return [order];
      }
      if (query.startsWith("INSERT INTO whop_payments")) {
        const paymentId = String(params[0]);
        if (payments.has(paymentId)) return [];
        payments.set(paymentId, { outcome: String(params[2]) });
        return [{ payment_id: paymentId }];
      }
      if (query.startsWith("UPDATE whop_payments")) {
        const payment = payments.get(String(params[0]));
        if (!payment || payment.outcome !== "failed") return [];
        payment.outcome = "paid";
        return [{ payment_id: params[0] }];
      }
      if (query.startsWith("SELECT outcome")) {
        const payment = payments.get(String(params[0]));
        return payment ? [payment] : [];
      }
      if (query.startsWith("DELETE")) {
        payments.delete(String(params[0]));
        return [];
      }
      throw new Error(`unexpected query: ${query}`);
    },
  };
  return { sql, orders, payments };
}

function notice(type: "payment.succeeded" | "payment.failed", paymentId = "pay_123") {
  return {
    id: "msg_123",
    type,
    data: {
      id: paymentId,
      metadata: { orderId: "RL-7F3K2Q" },
    },
  };
}

test("payment.succeeded marks the order paid and emails once", async () => {
  const { sql, orders } = memory();
  let emails = 0;
  const sendConfirmation = async () => {
    emails += 1;
  };
  const first = await applyWhopPayment(readWhopPaymentNotice(notice("payment.succeeded"))!, {
    sql,
    sendConfirmation,
  });
  const second = await applyWhopPayment(readWhopPaymentNotice(notice("payment.succeeded"))!, {
    sql,
    sendConfirmation,
  });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(orders.get("RL-7F3K2Q")?.status, "paid");
  assert.equal(emails, 1);
});

test("payment.failed marks the order failed and a later success still emails once", async () => {
  const { sql, orders } = memory();
  let emails = 0;
  const sendConfirmation = async () => {
    emails += 1;
  };
  await applyWhopPayment(readWhopPaymentNotice(notice("payment.failed"))!, { sql, sendConfirmation });
  assert.equal(orders.get("RL-7F3K2Q")?.status, "failed");
  await applyWhopPayment(readWhopPaymentNotice(notice("payment.succeeded"))!, { sql, sendConfirmation });
  assert.equal(orders.get("RL-7F3K2Q")?.status, "paid");
  assert.equal(emails, 1);
  await applyWhopPayment(readWhopPaymentNotice(notice("payment.failed", "pay_999"))!, {
    sql,
    sendConfirmation,
  });
  assert.equal(orders.get("RL-7F3K2Q")?.status, "paid");
  assert.equal(emails, 1);
});

test("a failed confirmation email releases the claim so the retry can send it", async () => {
  const { sql, payments } = memory();
  let attempts = 0;
  const sendConfirmation = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("mailbox unavailable");
  };
  const first = await applyWhopPayment(readWhopPaymentNotice(notice("payment.succeeded"))!, {
    sql,
    sendConfirmation,
  });
  assert.equal(first.status, 500);
  assert.equal(payments.has("pay_123"), false);
  const second = await applyWhopPayment(readWhopPaymentNotice(notice("payment.succeeded"))!, {
    sql,
    sendConfirmation,
  });
  assert.equal(second.status, 200);
  assert.equal(attempts, 2);
});

test("a payment without orderId is ignored", async () => {
  const { sql } = memory();
  const result = await applyWhopPayment(
    { type: "payment.succeeded", paymentId: "pay_123", orderId: null },
    { sql, sendConfirmation: async () => undefined },
  );
  assert.equal(result.status, 200);
  assert.equal(result.body, "ignored");
});
