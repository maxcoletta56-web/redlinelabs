import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { fulfillWhopPayment } from "./whop-fulfillment.ts";

function memory() {
  const orders = new Map<string, Record<string, unknown>>();
  orders.set("RL-7F3K2Q", {
    reference: "RL-7F3K2Q",
    status: "pending",
    currency: "aud",
    subtotal_cents: 24500,
    total_cents: 22050,
    promo_code: null,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    created_at: "2026-09-28T00:00:00Z",
    paid_at: null,
  });
  const events = new Map<string, { email_sent: boolean }>();
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("CREATE")) return [];
      if (query.includes("FROM orders")) {
        const row = orders.get(String(params?.[0]));
        return row ? [row] : [];
      }
      if (query.startsWith("UPDATE orders SET status = 'paid'")) {
        const row = orders.get(String(params?.[0]));
        if (!row) return [];
        row.status = "paid";
        row.paid_at = row.paid_at ?? "2026-09-28T01:00:00Z";
        return [row];
      }
      if (query.startsWith("UPDATE orders SET status = 'failed'")) {
        const row = orders.get(String(params?.[0]));
        if (!row || row.status === "paid") return [];
        row.status = "failed";
        return [row];
      }
      if (query.startsWith("INSERT INTO whop_payment_events")) {
        const key = `${params?.[0]}:${params?.[1]}`;
        if (events.has(key)) return [];
        events.set(key, { email_sent: false });
        return [{ payment_id: params?.[0] }];
      }
      if (query.startsWith("SELECT email_sent")) {
        const event = events.get(`${params?.[0]}:${params?.[1]}`);
        return event ? [{ email_sent: event.email_sent }] : [];
      }
      if (query.startsWith("UPDATE whop_payment_events")) {
        const event = events.get(`${params?.[0]}:${params?.[1]}`);
        if (!event || event.email_sent) return [];
        event.email_sent = true;
        return [{ payment_id: params?.[0] }];
      }
      return [];
    },
  };
  return { sql, orders };
}

const succeeded = {
  type: "payment.succeeded" as const,
  paymentId: "pay_abc123",
  orderId: "RL-7F3K2Q",
};

test("payment.succeeded marks the order paid and emails once", async () => {
  const { sql, orders } = memory();
  let emails = 0;
  const first = await fulfillWhopPayment(succeeded, {
    sql,
    sendConfirmation: async () => {
      emails += 1;
    },
  });
  const second = await fulfillWhopPayment(succeeded, {
    sql,
    sendConfirmation: async () => {
      emails += 1;
    },
  });
  assert.equal(first.body.outcome, "paid");
  assert.equal(second.body.outcome, "duplicate");
  assert.equal(emails, 1);
  assert.equal(orders.get("RL-7F3K2Q")?.status, "paid");
});

test("a failed email is retried and then recorded", async () => {
  const { sql } = memory();
  let emails = 0;
  const failed = await fulfillWhopPayment(succeeded, {
    sql,
    sendConfirmation: async () => {
      emails += 1;
      throw new Error("mailbox unavailable");
    },
  });
  assert.equal(failed.status, 500);
  const sent = await fulfillWhopPayment(succeeded, {
    sql,
    sendConfirmation: async () => {
      emails += 1;
    },
  });
  assert.equal(sent.body.outcome, "paid");
  assert.equal(emails, 2);
  const again = await fulfillWhopPayment(succeeded, {
    sql,
    sendConfirmation: async () => {
      emails += 1;
    },
  });
  assert.equal(again.body.outcome, "duplicate");
  assert.equal(emails, 2);
});

test("payment.failed marks a pending order failed once", async () => {
  const { sql, orders } = memory();
  const notice = { type: "payment.failed" as const, paymentId: "pay_failed1", orderId: "RL-7F3K2Q" };
  const first = await fulfillWhopPayment(notice, { sql });
  const second = await fulfillWhopPayment(notice, { sql });
  assert.equal(first.body.outcome, "failed");
  assert.equal(second.body.outcome, "duplicate");
  assert.equal(orders.get("RL-7F3K2Q")?.status, "failed");
});
