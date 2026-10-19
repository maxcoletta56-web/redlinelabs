import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import { awardOrderPoints, reserveRedemption } from "./club-db.ts";
import { TEST_PROGRAM, createFakeClubSql } from "./club-test-fixtures.ts";
import { settleAdminOrderPaid } from "./admin-mark-paid.ts";
import {
  OrderCancelledError,
  cancelOrder,
  cancelOrderAndReleasePoints,
  markOrderPaid,
  markOrderPaidWithPaymentEmail,
  type CancelOrderResult,
  type StoredOrder,
} from "./orders.ts";

const ADA = "ada@example.com";
const reference = "RL-7F3K2Q";

function stored(status: StoredOrder["status"], overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    reference,
    status,
    currency: "aud",
    subtotalCents: 10_000,
    totalCents: 10_000,
    promoCode: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: ADA,
    items: [],
    shipping: null,
    clubEmail: null,
    clubPointsRedeemed: 0,
    clubDiscountCents: 0,
    paymentMethod: "bank_transfer",
    paypalOrderId: null,
    createdAt: "2026-10-02T00:00:00.000Z",
    paidAt: status === "paid" ? "2026-10-02T01:00:00.000Z" : null,
    ...overrides,
  };
}

/** Mark-paid hooks wired to the in-memory club tables, with no email side effects. */
function paidHooks(db: ReturnType<typeof createFakeClubSql>, order: StoredOrder) {
  let row = order;
  let failAwards = 0;
  const logs: unknown[][] = [];
  const hooks = {
    findOrder: async () => row,
    markOrderPaid: async () => {
      row = { ...row, status: "paid" as const, paidAt: row.paidAt ?? "2026-10-02T01:00:00.000Z" };
      return row;
    },
    awardClubPoints: async (paid: StoredOrder) => {
      if (failAwards > 0) {
        failAwards -= 1;
        throw new Error("club database is down");
      }
      return awardOrderPoints(
        { email: paid.email, orderReference: paid.reference, paidCents: paid.totalCents },
        db.sql,
        TEST_PROGRAM,
      );
    },
    scheduleEmail: () => {},
    sendPaymentReceivedEmail: async () => {},
  };
  return { hooks, logs, failNext: (n: number) => (failAwards = n) };
}

async function quietly<T>(run: () => Promise<T>) {
  const original = console.error;
  const lines: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args);
  };
  try {
    return { value: await run(), lines };
  } finally {
    console.error = original;
  }
}

test("marking paid awards points once, however often it is repeated", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  const { hooks } = paidHooks(db, stored("awaiting_payment"));

  await markOrderPaidWithPaymentEmail(reference, hooks);
  await markOrderPaidWithPaymentEmail(reference, hooks);
  await Promise.all([
    markOrderPaidWithPaymentEmail(reference, hooks),
    markOrderPaidWithPaymentEmail(reference, hooks),
  ]);

  assert.equal(db.ledger.filter((l) => l.reason === "order").length, 1);
  assert.equal(db.balance(ADA), 100);
  assert.equal(db.members.get(ADA)?.spend, 10_000);
});

test("a failed award does not fail marking paid, and marking paid again retries it", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  const { hooks, failNext } = paidHooks(db, stored("awaiting_payment"));
  failNext(1);

  const first = await quietly(() => markOrderPaidWithPaymentEmail(reference, hooks));
  assert.equal(first.value?.status, "paid");
  assert.equal(db.balance(ADA), 0);
  assert.match(JSON.stringify(first.lines), /mark paid again or run club reconciliation/);
  assert.ok(!JSON.stringify(first.lines).includes(ADA));

  const retry = await markOrderPaidWithPaymentEmail(reference, hooks);
  assert.equal(retry?.status, "paid");
  assert.equal(db.balance(ADA), 100);
});

test("the desk still reports paid when the club is down", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  const { hooks, failNext } = paidHooks(db, stored("awaiting_payment"));
  failNext(1);
  const settled = await quietly(() => settleAdminOrderPaid(reference, hooks));
  assert.equal(settled.value.notice, "paid");
});

test("reconciliation recovers an award whose retry never came", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  db.orders.push({ reference, email: ADA, status: "paid", totalCents: 10_000, clubPointsRedeemed: 0, paidAt: "2026-10-02T01:00:00Z" });
  const { reconcileClub } = await import("./club-db.ts");
  const summary = await reconcileClub({}, db.sql, TEST_PROGRAM);
  assert.deepEqual(summary.awardedOrders, [reference]);
  assert.equal(db.balance(ADA), 100);
});

test("a non-member's paid order earns nothing and is not an error", async () => {
  const db = createFakeClubSql();
  const { hooks } = paidHooks(db, stored("awaiting_payment", { email: "stranger@example.com" }));
  const paid = await markOrderPaidWithPaymentEmail(reference, hooks);
  assert.equal(paid?.status, "paid");
  assert.equal(db.ledger.length, 0);
});

test("the paid statement refuses a cancelled order that held Club points", async () => {
  const calls: string[] = [];
  const sql: Sql = {
    query: async (query) => {
      calls.push(query);
      if (query.startsWith("UPDATE orders SET status = 'paid'")) return [];
      if (query.startsWith("SELECT")) {
        return [
          {
            reference,
            status: "cancelled",
            currency: "aud",
            subtotal_cents: 10_000,
            total_cents: 5_000,
            first_name: "Ada",
            last_name: "L",
            email: ADA,
            items: [],
            club_email: ADA,
            club_points_redeemed: 100,
            club_discount_cents: 500,
          },
        ];
      }
      return [];
    },
  };
  await assert.rejects(() => markOrderPaid(reference, sql), OrderCancelledError);
  assert.match(calls.find((q) => q.startsWith("UPDATE orders SET status = 'paid'")) ?? "", /NOT \(status = 'cancelled' AND club_points_redeemed > 0\)/);
});

test("the desk shows a blocked notice for a cancelled order with released points", async () => {
  const settled = await settleAdminOrderPaid(reference, {
    findOrder: async () => stored("cancelled", { clubPointsRedeemed: 100 }),
    markOrderPaid: async () => {
      throw new OrderCancelledError();
    },
  });
  assert.equal(settled.notice, "blocked");
});

test("cancelling an unpaid order releases its reserved points", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 300);
  await reserveRedemption({ email: ADA, points: 300, orderReference: reference }, db.sql);
  assert.equal(db.balance(ADA), 0);

  const order = stored("cancelled", { clubPointsRedeemed: 300, clubEmail: ADA, clubDiscountCents: 1_500 });
  const hooks = {
    cancelOrder: async (): Promise<CancelOrderResult> => ({ outcome: "cancelled", order }),
    releaseClubPoints: async (ref: string) => (await import("./club-db.ts")).releaseRedemption(ref, "Order cancelled", db.sql),
  };
  const first = await cancelOrderAndReleasePoints(reference, hooks);
  assert.equal(first.outcome, "cancelled");
  assert.equal(first.releaseFailed, false);
  assert.equal(db.balance(ADA), 300);

  // Cancelling again is harmless.
  const again = await cancelOrderAndReleasePoints(reference, {
    ...hooks,
    cancelOrder: async () => ({ outcome: "already_cancelled", order }),
  });
  assert.equal(again.releaseFailed, false);
  assert.equal(db.balance(ADA), 300);
  assert.equal(db.ledger.filter((l) => l.reason === "redeem_release").length, 1);
});

test("a failed release is reported and retried by cancelling again", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 300);
  await reserveRedemption({ email: ADA, points: 300, orderReference: reference }, db.sql);
  const order = stored("cancelled", { clubPointsRedeemed: 300 });
  let down = true;
  const hooks = {
    cancelOrder: async (): Promise<CancelOrderResult> => ({ outcome: "cancelled", order }),
    releaseClubPoints: async (ref: string) => {
      if (down) throw new Error("club database is down");
      return (await import("./club-db.ts")).releaseRedemption(ref, "Order cancelled", db.sql);
    },
  };
  const failed = await quietly(() => cancelOrderAndReleasePoints(reference, hooks));
  assert.equal(failed.value.outcome, "cancelled");
  assert.equal(failed.value.releaseFailed, true);
  assert.equal(db.balance(ADA), 0);

  down = false;
  const retried = await cancelOrderAndReleasePoints(reference, {
    ...hooks,
    cancelOrder: async () => ({ outcome: "already_cancelled", order }),
  });
  assert.equal(retried.releaseFailed, false);
  assert.equal(db.balance(ADA), 300);
});

test("a paid order cannot be cancelled and nothing is released", async () => {
  let released = false;
  const result = await cancelOrderAndReleasePoints(reference, {
    cancelOrder: async () => ({ outcome: "paid", order: stored("paid", { clubPointsRedeemed: 300 }) }),
    releaseClubPoints: async () => {
      released = true;
    },
  });
  assert.equal(result.outcome, "paid");
  assert.equal(released, false);
});

test("an order without a redemption releases nothing on cancel", async () => {
  let released = false;
  const result = await cancelOrderAndReleasePoints(reference, {
    cancelOrder: async () => ({ outcome: "cancelled", order: stored("cancelled") }),
    releaseClubPoints: async () => {
      released = true;
    },
  });
  assert.equal(result.releaseFailed, false);
  assert.equal(released, false);
});

test("cancel only touches an awaiting-payment order", async () => {
  const queries: string[] = [];
  const sql: Sql = {
    query: async (query) => {
      queries.push(query);
      return [];
    },
  };
  assert.deepEqual(await cancelOrder(reference, sql), { outcome: "missing" });
  assert.match(queries.find((q) => q.startsWith("UPDATE orders SET status = 'cancelled'")) ?? "", /status = 'awaiting_payment'/);
  assert.deepEqual(await cancelOrder("not a reference", sql), { outcome: "missing" });
});
