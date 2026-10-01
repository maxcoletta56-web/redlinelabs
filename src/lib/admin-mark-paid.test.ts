import assert from "node:assert/strict";
import test from "node:test";
import { settleAdminOrderPaid } from "./admin-mark-paid.ts";
import {
  markOrderPaidWithPaymentEmail,
  type PaymentReceivedNotice,
  type StoredOrder,
} from "./orders.ts";

const reference = "RL-7F3K2Q";
const paidLocation = "/admin/orders?notice=paid&reference=RL-7F3K2Q";

function storedOrder(status: StoredOrder["status"]): StoredOrder {
  return {
    reference,
    status,
    currency: "aud",
    subtotalCents: 20000,
    totalCents: 16000,
    promoCode: null,
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    items: [],
    shipping: null,
    createdAt: "2026-09-27T01:00:00.000Z",
    paidAt: status === "paid" ? "2026-09-27T02:00:00.000Z" : null,
    whopPaymentId: null,
  };
}

function emailHooks(options: {
  existing: StoredOrder | null;
  findError?: Error;
  mark: (reference: string) => Promise<StoredOrder | null>;
  send?: (notice: PaymentReceivedNotice) => Promise<void>;
}) {
  const sent: PaymentReceivedNotice[] = [];
  const emailErrors: unknown[] = [];
  let scheduled = 0;
  const jobs: Promise<void>[] = [];
  const hooks = {
    findOrder: async () => {
      if (options.findError) throw options.findError;
      return options.existing;
    },
    markOrderPaid: options.mark,
    scheduleEmail: (scheduledReference: string, task: () => Promise<void>) => {
      scheduled += 1;
      assert.equal(scheduledReference, reference);
      jobs.push(
        task().then(
          () => undefined,
          (error: unknown) => {
            emailErrors.push(error);
          },
        ),
      );
    },
    sendPaymentReceivedEmail: async (notice: PaymentReceivedNotice) => {
      sent.push(notice);
      if (options.send) await options.send(notice);
    },
  };
  return {
    hooks,
    sent,
    jobs,
    emailErrors,
    scheduled: () => scheduled,
  };
}

test("awaiting payment to paid sends one payment-received email", async () => {
  let row = storedOrder("awaiting_payment");
  const capture = emailHooks({
    existing: row,
    mark: async () => {
      row = storedOrder("paid");
      return row;
    },
  });

  const updated = await markOrderPaidWithPaymentEmail(reference, capture.hooks);
  await Promise.all(capture.jobs);

  assert.equal(updated?.status, "paid");
  assert.equal(row.status, "paid");
  assert.equal(capture.scheduled(), 1);
  assert.deepEqual(capture.sent, [
    {
      reference,
      firstName: "Ada",
      email: "ada@example.com",
      totalCents: 16000,
    },
  ]);
});

test("marking an already-paid order sends no second email", async () => {
  const row = storedOrder("paid");
  let marked = false;
  const capture = emailHooks({
    existing: row,
    mark: async () => {
      marked = true;
      return row;
    },
  });

  const updated = await markOrderPaidWithPaymentEmail(reference, capture.hooks);
  await Promise.all(capture.jobs);

  assert.equal(marked, true);
  assert.equal(updated?.status, "paid");
  assert.equal(capture.scheduled(), 0);
  assert.deepEqual(capture.sent, []);
});

test("a thrown email error still leaves the order paid and redirects to notice=paid", async () => {
  let row = storedOrder("awaiting_payment");
  const capture = emailHooks({
    existing: row,
    mark: async () => {
      row = storedOrder("paid");
      return row;
    },
    send: async () => {
      throw new Error("mailbox unavailable");
    },
  });

  const settled = await settleAdminOrderPaid(reference, capture.hooks);
  await Promise.all(capture.jobs);

  assert.equal(row.status, "paid");
  assert.equal(settled.notice, "paid");
  assert.equal(settled.location, paidLocation);
  assert.equal(capture.scheduled(), 1);
  assert.equal(capture.emailErrors.length, 1);
  assert.equal(capture.sent.length, 1);
});

test("a findOrder failure does not block the status update", async () => {
  let row = storedOrder("awaiting_payment");
  let marked = false;
  const capture = emailHooks({
    existing: null,
    findError: new Error("connection refused"),
    mark: async () => {
      marked = true;
      row = storedOrder("paid");
      return row;
    },
  });
  const lines: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args);
  };

  try {
    const updated = await markOrderPaidWithPaymentEmail(reference, capture.hooks);
    await Promise.all(capture.jobs);

    assert.equal(marked, true);
    assert.equal(updated?.status, "paid");
    assert.equal(row.status, "paid");
    const logged = JSON.stringify(lines);
    assert.equal(logged.includes("ada@example.com"), false);
    assert.match(logged, /order lookup before paid email failed/);
    assert.match(logged, /connection refused/);
    assert.equal(capture.scheduled(), 1);
  } finally {
    console.error = original;
  }
});
