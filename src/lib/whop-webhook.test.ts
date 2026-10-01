import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { applyWhopPaymentEvent } from "./whop-webhook.ts";

function orderRow(status: string) {
  return {
    reference: "RL-7F3K2Q",
    status,
    currency: "aud",
    subtotal_cents: 20000,
    total_cents: 18000,
    promo_code: null,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    created_at: "2026-09-29T00:00:00Z",
    paid_at: status === "paid" ? "2026-09-29T00:01:00Z" : null,
  };
}

function memorySql(initialStatus: string) {
  const payments = new Set<string>();
  let status = initialStatus;
  let emails = 0;
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("CREATE")) return [];
      if (query.startsWith("INSERT INTO whop_payments")) {
        const id = String(params?.[0]);
        if (payments.has(id)) return [];
        payments.add(id);
        return [{ payment_id: id }];
      }
      if (query.startsWith("DELETE")) {
        payments.delete(String(params?.[0]));
        return [];
      }
      if (query.includes("status = 'paid'") && query.includes("'pending', 'failed'")) {
        if (status !== "pending" && status !== "failed") return [];
        status = "paid";
        return [orderRow("paid")];
      }
      if (query.includes("status = 'failed'")) {
        if (status !== "pending") return [];
        status = "failed";
        return [orderRow("failed")];
      }
      if (query.startsWith("SELECT")) return [orderRow(status)];
      return [];
    },
  };
  return {
    sql,
    paidEmails() {
      return emails;
    },
    noteEmail() {
      emails += 1;
    },
  };
}

test("payment.succeeded marks a pending order paid once per payment id", async () => {
  const db = memorySql("pending");
  const first = await applyWhopPaymentEvent(
    { type: "payment.succeeded", paymentId: "pay_123", orderId: "rl-7f3k2q" },
    db.sql,
  );
  assert.equal(first.outcome, "paid");
  assert.equal(first.email, true);
  assert.equal(first.order?.status, "paid");
  if (first.email) db.noteEmail();

  const repeat = await applyWhopPaymentEvent(
    { type: "payment.succeeded", paymentId: "pay_123", orderId: "RL-7F3K2Q" },
    db.sql,
  );
  assert.equal(repeat.outcome, "duplicate");
  assert.equal(repeat.email, false);
  assert.equal(db.paidEmails(), 1);
});

test("payment.failed marks pending failed and does not unpay a later success", async () => {
  const db = memorySql("pending");
  const failed = await applyWhopPaymentEvent(
    { type: "payment.failed", paymentId: "pay_fail", orderId: "RL-7F3K2Q" },
    db.sql,
  );
  assert.equal(failed.outcome, "failed");
  assert.equal(failed.email, false);
  assert.equal(failed.order?.status, "failed");

  const again = await applyWhopPaymentEvent(
    { type: "payment.failed", paymentId: "pay_fail", orderId: "RL-7F3K2Q" },
    db.sql,
  );
  assert.equal(again.outcome, "duplicate");

  const recovered = await applyWhopPaymentEvent(
    { type: "payment.succeeded", paymentId: "pay_ok", orderId: "RL-7F3K2Q" },
    db.sql,
  );
  assert.equal(recovered.outcome, "paid");
  assert.equal(recovered.email, true);
});

test("a failed event does not mark a paid order failed", async () => {
  const db = memorySql("paid");
  const result = await applyWhopPaymentEvent(
    { type: "payment.failed", paymentId: "pay_late", orderId: "RL-7F3K2Q" },
    db.sql,
  );
  assert.equal(result.outcome, "ignored");
  assert.equal(result.email, false);
  assert.equal(result.order?.status, "paid");
});
