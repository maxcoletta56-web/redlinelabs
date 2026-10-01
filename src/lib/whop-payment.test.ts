import assert from "node:assert/strict";
import test from "node:test";
import type { StoredOrder } from "./orders.ts";
import { settleWhopPayment } from "./whop-payment.ts";
import type { WhopPaymentNotice } from "./whop-event.ts";

function order(status: StoredOrder["status"], whopPaymentId: string | null = null): StoredOrder {
  return {
    reference: "RL-7F3K2Q",
    status,
    currency: "aud",
    subtotalCents: 20000,
    totalCents: 18000,
    promoCode: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    paidAt: status === "paid" ? "2026-10-01T00:01:00.000Z" : null,
    whopPaymentId,
  };
}

const succeeded: WhopPaymentNotice = {
  type: "payment.succeeded",
  paymentId: "pay_abc123",
  orderId: "rl-7f3k2q",
  amountCents: 18000,
  currency: "aud",
};

test("payment.succeeded marks the pending order paid once and emails once", async () => {
  let current = order("pending");
  const sent: string[] = [];
  const first = await settleWhopPayment(succeeded, {
    findOrder: async () => current,
    markPaid: async () => {
      current = order("paid", succeeded.paymentId);
      return current;
    },
    scheduleEmail: (_reference, task) => {
      void task();
    },
    sendPaymentReceivedEmail: async (notice) => {
      sent.push(notice.reference);
    },
  });
  assert.equal(first.outcome, "paid");
  const second = await settleWhopPayment(succeeded, {
    findOrder: async () => current,
    markPaid: async () => {
      throw new Error("paid twice");
    },
    sendPaymentReceivedEmail: async () => {
      sent.push("again");
    },
  });
  assert.equal(second.outcome, "duplicate");
  assert.deepEqual(sent, ["RL-7F3K2Q"]);
});

test("a mismatched amount is not marked paid", async () => {
  const result = await settleWhopPayment(
    { ...succeeded, amountCents: 100 },
    {
      findOrder: async () => order("pending"),
      markPaid: async () => {
        throw new Error("should not mark paid");
      },
    },
  );
  assert.equal(result.outcome, "mismatch");
});

test("payment.failed marks pending failed and does not downgrade a paid order", async () => {
  const failed: WhopPaymentNotice = { ...succeeded, type: "payment.failed", amountCents: null };
  let current = order("pending");
  const first = await settleWhopPayment(failed, {
    findOrder: async () => current,
    markFailed: async (_reference, paymentId) => {
      current = order("failed", paymentId);
      return current;
    },
  });
  assert.equal(first.outcome, "failed");
  const replay = await settleWhopPayment(failed, {
    findOrder: async () => current,
    markFailed: async () => {
      throw new Error("failed twice");
    },
  });
  assert.equal(replay.outcome, "duplicate");

  const paid = await settleWhopPayment(failed, {
    findOrder: async () => order("paid", "pay_other"),
    markFailed: async () => {
      throw new Error("downgraded");
    },
  });
  assert.equal(paid.outcome, "ignored");
});

test("a later success after failure still pays and emails", async () => {
  const sent: string[] = [];
  const result = await settleWhopPayment(
    { ...succeeded, paymentId: "pay_retry" },
    {
      findOrder: async () => order("failed", "pay_abc123"),
      markPaid: async () => order("paid", "pay_retry"),
      scheduleEmail: (_reference, task) => {
        void task();
      },
      sendPaymentReceivedEmail: async () => {
        sent.push("sent");
      },
    },
  );
  assert.equal(result.outcome, "paid");
  assert.deepEqual(sent, ["sent"]);
});
