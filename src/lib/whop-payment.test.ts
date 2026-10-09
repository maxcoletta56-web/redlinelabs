import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { applyWhopPayment, type StoredOrder } from "./orders.ts";
import { signWhopWebhook } from "./whop-signature.ts";
import { normalizeWhopEventType, receiveWhopWebhook, whopRecoveryUrl } from "./whop-webhook.ts";

type Row = Record<string, unknown>;

function orderRow(overrides: Row = {}): Row {
  return {
    reference: "RL-7F3K2Q",
    status: "pending",
    currency: "aud",
    subtotal_cents: 26700,
    total_cents: 24030,
    promo_code: null,
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    club_email: null,
    club_points_redeemed: 0,
    club_discount_cents: 0,
    payment_method: "whop",
    paypal_order_id: null,
    whop_payment_id: null,
    created_at: "2026-10-09T00:00:00Z",
    paid_at: null,
    ...overrides,
  };
}

/** Applies the same predicates as the Whop settlement statements. */
function memoryOrders(initial: Row) {
  let row: Row | null = { ...initial };
  const sql: Sql = {
    query: async (query, params) => {
      if (query.startsWith("CREATE") || query.startsWith("ALTER")) return [];
      const reference = String(params?.[0] ?? "");
      const paymentId = String(params?.[1] ?? "");
      if (!row || row.reference !== reference) return [];
      if (query.startsWith("UPDATE orders SET status = 'paid'")) {
        const payable = row.status === "pending" || row.status === "awaiting_payment" || row.status === "failed";
        const sameId = row.whop_payment_id == null || row.whop_payment_id === paymentId;
        if (!payable || !sameId) return [];
        row = {
          ...row,
          status: "paid",
          paid_at: row.paid_at ?? "2026-10-09T01:00:00Z",
          whop_payment_id: paymentId,
        };
        return [{ ...row }];
      }
      if (query.startsWith("UPDATE orders SET status = 'failed'")) {
        const payable = row.status === "pending" || row.status === "awaiting_payment";
        const sameId = row.whop_payment_id == null || row.whop_payment_id === paymentId;
        if (!payable || !sameId) return [];
        row = { ...row, status: "failed", whop_payment_id: paymentId };
        return [{ ...row }];
      }
      if (query.startsWith("UPDATE orders SET whop_payment_id")) {
        const waiting = row.status === "pending" || row.status === "awaiting_payment";
        if (!waiting || row.whop_payment_id != null) return [];
        row = { ...row, whop_payment_id: paymentId };
        return [{ ...row }];
      }
      if (query.startsWith("SELECT")) return [{ ...row }];
      return [];
    },
  };
  return {
    sql,
    current: () => row,
  };
}

test("the same Whop payment id does not pay or email twice", async () => {
  const db = memoryOrders(orderRow());
  const first = await applyWhopPayment("rl-7f3k2q", "pay_same", "paid", db.sql);
  const second = await applyWhopPayment("RL-7F3K2Q", "pay_same", "paid", db.sql);
  assert.equal(first.outcome, "paid");
  assert.equal(first.outcome === "paid" && first.transitioned, true);
  assert.equal(second.outcome, "paid");
  assert.equal(second.outcome === "paid" && second.transitioned, false);
  assert.equal(db.current()?.status, "paid");
  assert.equal(db.current()?.whop_payment_id, "pay_same");
});

test("a different payment id cannot unpay or overwrite a paid order", async () => {
  const db = memoryOrders(orderRow({ status: "paid", whop_payment_id: "pay_aaa", paid_at: "2026-10-09T01:00:00Z" }));
  const failed = await applyWhopPayment("RL-7F3K2Q", "pay_bbb", "failed", db.sql);
  const paid = await applyWhopPayment("RL-7F3K2Q", "pay_bbb", "paid", db.sql);
  assert.equal(failed.outcome, "ignored");
  assert.equal(paid.outcome, "ignored");
  assert.equal(db.current()?.status, "paid");
  assert.equal(db.current()?.whop_payment_id, "pay_aaa");
});

test("a failed card can still be marked paid by the same payment id", async () => {
  const db = memoryOrders(orderRow());
  const failed = await applyWhopPayment("RL-7F3K2Q", "pay_retry", "failed", db.sql);
  const paid = await applyWhopPayment("RL-7F3K2Q", "pay_retry", "paid", db.sql);
  assert.equal(failed.outcome, "failed");
  assert.equal(failed.outcome === "failed" && failed.transitioned, true);
  assert.equal(paid.outcome, "paid");
  assert.equal(paid.outcome === "paid" && paid.transitioned, true);
  assert.equal(db.current()?.status, "paid");
});

test("an in-progress 3DS note still lets the later success email once", async () => {
  const db = memoryOrders(orderRow());
  const action = await applyWhopPayment("RL-7F3K2Q", "pay_3ds", "action_required", db.sql);
  const paid = await applyWhopPayment("RL-7F3K2Q", "pay_3ds", "paid", db.sql);
  assert.equal(action.outcome, "action_required");
  assert.equal(action.outcome === "action_required" && action.transitioned, true);
  assert.equal(paid.outcome === "paid" && paid.transitioned, true);
  const replay = await applyWhopPayment("RL-7F3K2Q", "pay_3ds", "action_required", db.sql);
  assert.equal(replay.outcome, "ignored");
});

const SECRET = "ws_test_secret";
const NOW = 1_700_000_000;

function signed(payload: unknown) {
  const raw = JSON.stringify(payload);
  return {
    raw,
    headers: {
      "webhook-id": "msg_whop",
      "webhook-timestamp": String(NOW),
      "webhook-signature": signWhopWebhook(raw, SECRET, "msg_whop", NOW),
    },
  };
}

test("event names with underscores settle the same as dotted names", () => {
  assert.equal(normalizeWhopEventType("payment_succeeded"), "payment.succeeded");
  assert.equal(normalizeWhopEventType(" Payment.Failed "), "payment.failed");
  assert.equal(normalizeWhopEventType("payment_requires_action"), "payment.requires_action");
  assert.equal(normalizeWhopEventType("payment.requires_action"), "payment.requires_action");
});

test("payment.succeeded marks the order paid and confirms once", async () => {
  const db = memoryOrders(orderRow());
  const confirmed: string[] = [];
  const body = signed({
    type: "payment_succeeded",
    data: { id: "pay_ok", metadata: { orderId: "rl-7f3k2q" } },
  });
  const deps = {
    secret: SECRET,
    nowSeconds: NOW,
    applyPayment: (reference: string, paymentId: string, outcome: "paid" | "failed" | "action_required") =>
      applyWhopPayment(reference, paymentId, outcome, db.sql),
    sendConfirmation: async (order: StoredOrder) => {
      confirmed.push(order.reference);
    },
  };
  assert.equal((await receiveWhopWebhook(body.raw, body.headers, deps)).status, 200);
  assert.equal((await receiveWhopWebhook(body.raw, body.headers, deps)).status, 200);
  assert.deepEqual(confirmed, ["RL-7F3K2Q"]);
  assert.equal(db.current()?.status, "paid");
});

test("payment.failed marks the order failed and a bad signature is refused", async () => {
  const db = memoryOrders(orderRow());
  const body = signed({
    type: "payment.failed",
    data: { id: "pay_no", metadata: { order_id: "RL-7F3K2Q" } },
  });
  const result = await receiveWhopWebhook(body.raw, body.headers, {
    secret: SECRET,
    nowSeconds: NOW,
    applyPayment: (reference, paymentId, outcome) => applyWhopPayment(reference, paymentId, outcome, db.sql),
  });
  assert.equal(result.status, 200);
  assert.equal(db.current()?.status, "failed");

  const rejected = await receiveWhopWebhook(body.raw, body.headers, {
    secret: "ws_wrong",
    nowSeconds: NOW,
  });
  assert.equal(rejected.status, 401);
  const unrelated = signed({ type: "membership.went_valid", data: { id: "mem_1" } });
  assert.equal(
    (await receiveWhopWebhook(unrelated.raw, unrelated.headers, { secret: SECRET, nowSeconds: NOW })).status,
    200,
  );
});

test("off-session 3DS recovery links are emailed only when they are on whop.com", async () => {
  assert.equal(whopRecoveryUrl("https://whop.com/checkout/recover"), "https://whop.com/checkout/recover");
  assert.equal(whopRecoveryUrl("https://dash.whop.com/pay"), "https://dash.whop.com/pay");
  assert.equal(whopRecoveryUrl("http://whop.com/pay"), null);
  assert.equal(whopRecoveryUrl("https://evil.com/whop.com"), null);
  assert.equal(whopRecoveryUrl("https://user:pass@whop.com/pay"), null);

  const db = memoryOrders(orderRow());
  const sent: string[] = [];
  const body = signed({
    type: "payment.requires_action",
    data: {
      id: "pay_3ds",
      metadata: { orderId: "RL-7F3K2Q" },
      recovery_url: "https://whop.com/checkout/pay_3ds",
    },
  });
  await receiveWhopWebhook(body.raw, body.headers, {
    secret: SECRET,
    nowSeconds: NOW,
    applyPayment: (reference, paymentId, outcome) => applyWhopPayment(reference, paymentId, outcome, db.sql),
    sendRecovery: async (_order, url) => {
      sent.push(url);
    },
  });
  assert.deepEqual(sent, ["https://whop.com/checkout/pay_3ds"]);
  assert.equal(db.current()?.status, "pending");
  assert.equal(db.current()?.whop_payment_id, "pay_3ds");
});
