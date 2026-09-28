import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { settleWhopPayment } from "./orders.ts";
import { handleWhopWebhook } from "./whop-webhook.ts";

const REFERENCE = "RL-7F3K2Q";
const PAYMENT = "pay_test1";

function paidRow(confirmation: string | null = null) {
  return {
    reference: REFERENCE,
    status: "paid",
    currency: "aud",
    subtotal_cents: 11000,
    total_cents: 11000,
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    items: "[]",
    whop_payment_id: PAYMENT,
    payment_method: "card",
    confirmation_sent_at: confirmation,
  };
}

function scripted(rows: unknown[][]) {
  const queue = [...rows];
  const calls: string[] = [];
  const sql: Sql = {
    query: async (query) => {
      calls.push(query);
      if (query.startsWith("CREATE")) return [];
      return queue.shift() ?? [];
    },
  };
  return { sql, calls };
}

test("the first succeeded delivery marks the order paid and sends one email", async () => {
  const { sql, calls } = scripted([[paidRow()], [paidRow()]]);
  const sent: string[] = [];
  const result = await handleWhopWebhook(
    { type: "payment.succeeded", data: { id: PAYMENT, metadata: { orderId: REFERENCE } } },
    {
      sql,
      mail: {
        apiKey: "re_test",
        from: "Redline Labs <orders@example.com>",
        fetchImpl: async () => {
          sent.push(PAYMENT);
          return new Response("{}", { status: 200 });
        },
      },
    },
  );
  assert.equal(result.outcome, "paid");
  assert.equal(result.retry, false);
  assert.deepEqual(sent, [PAYMENT]);
  assert.ok(calls.some((query) => query.includes("whop_payment_id = $2") && query.includes("status = 'paid'")));
  assert.ok(calls.some((query) => query.includes("confirmation_sent_at = now()")));
});

test("a repeated payment id does not send another email", async () => {
  const { sql } = scripted([[], [paidRow("2026-09-28T00:00:00Z")]]);
  let sent = 0;
  const result = await handleWhopWebhook(
    { type: "payment.succeeded", data: { id: PAYMENT, metadata: { orderId: REFERENCE } } },
    {
      sql,
      mail: {
        apiKey: "re_test",
        from: "Redline Labs <orders@example.com>",
        fetchImpl: async () => {
          sent += 1;
          return new Response("{}", { status: 200 });
        },
      },
    },
  );
  assert.equal(result.outcome, "duplicate");
  assert.equal(sent, 0);
});

test("payment.failed does not overwrite a paid order", async () => {
  const { sql, calls } = scripted([[], [{ ...paidRow("2026-09-28T00:00:00Z"), status: "paid" }]]);
  const result = await settleWhopPayment({ reference: REFERENCE, paymentId: PAYMENT, event: "failed" }, sql);
  assert.equal(result.outcome, "ignored");
  assert.ok(calls.some((query) => query.includes("status = 'pending'")));
});

test("payment.requires_action leaves the order pending", async () => {
  const sql: Sql = {
    query: async () => {
      throw new Error("requires_action must not touch the order");
    },
  };
  const result = await handleWhopWebhook(
    { type: "payment.requires_action", data: { id: PAYMENT, metadata: { orderId: REFERENCE } } },
    { sql },
  );
  assert.deepEqual(result, { outcome: "action_required", retry: false });
});

test("a failed confirmation email is released so the retry can send it", async () => {
  const { sql, calls } = scripted([[paidRow()], [paidRow()]]);
  const result = await handleWhopWebhook(
    { type: "payment.succeeded", data: { id: PAYMENT, metadata: { orderId: REFERENCE } } },
    {
      sql,
      mail: {
        apiKey: "",
        from: "",
      },
    },
  );
  assert.equal(result.retry, true);
  assert.ok(calls.some((query) => query.includes("confirmation_sent_at = NULL")));
});
