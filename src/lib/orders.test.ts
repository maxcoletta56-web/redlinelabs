import assert from "node:assert/strict";
import test from "node:test";
import { applyWhopPayment, createMemoryOrderStore, type StoredOrder } from "./orders.ts";

function sample(): StoredOrder {
  return {
    id: "ord_test",
    status: "pending",
    email: "max@example.com",
    firstName: "Max",
    lastName: "Cole",
    currency: "aud",
    subtotalCents: 25000,
    volumeDiscountCents: 2500,
    promoCode: "",
    promoDiscountCents: 0,
    totalCents: 22500,
    lines: [],
    shipping: null,
    paymentMethod: "card",
    whopCheckoutId: "ch_test",
    whopPaymentId: null,
    confirmationSentAt: null,
    createdAt: new Date().toISOString(),
  };
}

test("payment.succeeded is idempotent on the Whop payment id", async () => {
  const store = createMemoryOrderStore();
  await store.insert(sample());
  const sent: string[] = [];
  const event = {
    type: "payment.succeeded",
    data: { id: "pay_123", metadata: { orderId: "ord_test" } },
  };
  const first = await applyWhopPayment(store, event, async (order) => {
    sent.push(order.whopPaymentId ?? "");
  });
  const second = await applyWhopPayment(store, event, async () => {
    sent.push("again");
  });
  assert.equal(first.outcome, "paid");
  assert.equal(second.outcome, "already");
  assert.deepEqual(sent, ["pay_123"]);
  const order = await store.get("ord_test");
  assert.equal(order?.status, "paid");
  assert.equal(order?.whopPaymentId, "pay_123");
});

test("payment.failed does not overwrite a paid order", async () => {
  const store = createMemoryOrderStore();
  await store.insert(sample());
  await applyWhopPayment(
    store,
    { type: "payment.succeeded", data: { id: "pay_123", metadata: { orderId: "ord_test" } } },
    async () => {},
  );
  const failed = await applyWhopPayment(
    store,
    { type: "payment.failed", data: { id: "pay_123", metadata: { orderId: "ord_test" } } },
    async () => {
      throw new Error("should not email");
    },
  );
  assert.equal(failed.outcome, "ignored");
  assert.equal((await store.get("ord_test"))?.status, "paid");
});

test("payment.failed marks a pending order once", async () => {
  const store = createMemoryOrderStore();
  await store.insert(sample());
  const event = { event: "payment.failed", data: { id: "pay_fail", metadata: { orderId: "ord_test" } } };
  assert.equal((await applyWhopPayment(store, event, async () => {})).outcome, "failed");
  assert.equal((await applyWhopPayment(store, event, async () => {})).outcome, "already");
  assert.equal((await store.get("ord_test"))?.status, "failed");
});

test("payment.succeeded matches the saved checkout configuration when metadata is absent", async () => {
  const store = createMemoryOrderStore();
  await store.insert(sample());
  await store.attachCheckout("ord_test", "ch_test");
  const result = await applyWhopPayment(
    store,
    { type: "payment.succeeded", data: { id: "pay_456", checkout_configuration_id: "ch_test" } },
    async () => {},
  );
  assert.equal(result.outcome, "paid");
  assert.equal((await store.get("ord_test"))?.whopPaymentId, "pay_456");
});

test("a failed email can be retried for the same payment", async () => {
  const store = createMemoryOrderStore();
  await store.insert(sample());
  const event = { type: "payment.succeeded", data: { id: "pay_123", metadata: { orderId: "ord_test" } } };
  await assert.rejects(applyWhopPayment(store, event, async () => {
    throw new Error("mailbox down");
  }));
  assert.equal((await store.get("ord_test"))?.status, "paid");
  assert.equal((await store.get("ord_test"))?.confirmationSentAt, null);
  const sent: string[] = [];
  const retry = await applyWhopPayment(store, event, async () => {
    sent.push("sent");
  });
  assert.equal(retry.outcome, "paid");
  assert.deepEqual(sent, ["sent"]);
});
