import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createMemoryOrderStore, applyWhopPayment, type StoredOrder } from "./orders.ts";
import { moneyToCents, readWhopPaymentNotice } from "./whop-events.ts";
import { whopModeFromEnv, audMajorUnits } from "./whop-mode.ts";
import { readNextAction } from "./whop-next-action.ts";
import { verifyWhopWebhook } from "./whop-signature.ts";

const SECRET = "ws_test_secret";

function sign(payload: string, secret = SECRET, at = new Date()) {
  const id = "msg_test";
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

function pendingOrder(totalCents = 18000): StoredOrder {
  return {
    id: "ord_11111111-1111-1111-1111-111111111111",
    email: "max@example.com",
    status: "pending",
    currency: "aud",
    subtotalCents: 20000,
    discountCents: 2000,
    totalCents,
    lines: [],
    shipping: null,
    promoCode: "",
    whopCheckoutId: "ch_test",
    whopPaymentId: null,
    confirmationSent: false,
    createdAt: "2026-09-26T00:00:00.000Z",
  };
}

test("whop mode stays in sandbox until live is requested", () => {
  assert.equal(whopModeFromEnv(undefined), "sandbox");
  assert.equal(whopModeFromEnv("sandbox"), "sandbox");
  assert.equal(whopModeFromEnv("live"), "production");
  assert.equal(audMajorUnits(18000), 180);
  assert.equal(audMajorUnits(1999), 19.99);
});

test("webhook signature accepts the raw secret and rejects tampering", () => {
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: {
      id: "pay_123",
      currency: "aud",
      total: { amount: "180.00", currency: "aud", decimals: 2 },
      metadata: { orderId: "ord_11111111-1111-1111-1111-111111111111" },
    },
  });
  const headers = sign(payload);
  const body = verifyWhopWebhook(payload, headers, SECRET);
  assert.equal(readWhopPaymentNotice(body)?.paymentId, "pay_123");
  assert.equal(readWhopPaymentNotice(body)?.amountCents, 18000);
  assert.throws(() => verifyWhopWebhook(payload, headers, "ws_other"));
  assert.throws(() =>
    verifyWhopWebhook(payload, { ...headers, "webhook-timestamp": "100" }, SECRET, Date.now()),
  );
});

test("money conversion reads Whop decimal strings", () => {
  assert.equal(moneyToCents({ amount: "10.00", currency: "aud", decimals: 2 }), 1000);
  assert.equal(moneyToCents(null), null);
});

test("succeeded webhook marks the order paid once and sends one email", async () => {
  const store = createMemoryOrderStore();
  const order = pendingOrder();
  await store.save(order);
  let sent = 0;
  const notice = {
    type: "payment.succeeded" as const,
    paymentId: "pay_123",
    orderId: order.id,
    amountCents: 18000,
    currency: "aud",
  };
  const first = await applyWhopPayment(store, notice, async () => {
    sent += 1;
  });
  const second = await applyWhopPayment(store, notice, async () => {
    sent += 1;
  });
  const saved = await store.find(order.id);
  assert.equal(first.outcome, "paid");
  assert.equal(second.outcome, "duplicate");
  assert.equal(saved?.status, "paid");
  assert.equal(saved?.whopPaymentId, "pay_123");
  assert.equal(saved?.confirmationSent, true);
  assert.equal(sent, 1);
});

test("a failed payment does not overwrite a paid order", async () => {
  const store = createMemoryOrderStore();
  const order = pendingOrder();
  await store.save(order);
  await applyWhopPayment(
    store,
    {
      type: "payment.succeeded",
      paymentId: "pay_ok",
      orderId: order.id,
      amountCents: 18000,
      currency: "aud",
    },
    async () => {},
  );
  const failed = await applyWhopPayment(
    store,
    {
      type: "payment.failed",
      paymentId: "pay_bad",
      orderId: order.id,
      amountCents: null,
      currency: null,
    },
    async () => {
      throw new Error("failed payments do not email");
    },
  );
  assert.equal(failed.outcome, "ignored");
  assert.equal((await store.find(order.id))?.status, "paid");
});

test("payment.failed marks a pending order failed once", async () => {
  const store = createMemoryOrderStore();
  const order = pendingOrder();
  await store.save(order);
  const notice = {
    type: "payment.failed" as const,
    paymentId: "pay_bad",
    orderId: order.id,
    amountCents: null,
    currency: null,
  };
  assert.equal((await applyWhopPayment(store, notice, async () => {})).outcome, "failed");
  assert.equal((await applyWhopPayment(store, notice, async () => {})).outcome, "duplicate");
  assert.equal((await store.find(order.id))?.status, "failed");
});

test("a mismatched amount does not mark the order paid", async () => {
  const store = createMemoryOrderStore();
  const order = pendingOrder();
  await store.save(order);
  const result = await applyWhopPayment(
    store,
    {
      type: "payment.succeeded",
      paymentId: "pay_low",
      orderId: order.id,
      amountCents: 100,
      currency: "aud",
    },
    async () => {
      throw new Error("should not email");
    },
  );
  assert.equal(result.outcome, "mismatch");
  assert.equal((await store.find(order.id))?.status, "pending");
});

test("next actions choose inline 3DS, full page redirect, and bank instructions", () => {
  assert.deepEqual(
    readNextAction({
      type: "redirect",
      render: ["inline", "full_page"],
      data: { url: "https://bank.example/3ds", frame_max_width: 400 },
    }),
    {
      kind: "redirect",
      url: "https://bank.example/3ds",
      mode: "inline",
      frameMaxWidth: 400,
    },
  );
  assert.equal(
    readNextAction({
      type: "redirect",
      render: ["full_page"],
      data: { url: "javascript:alert(1)", frame_max_width: null },
    }),
    null,
  );
  const instructions = readNextAction({
    type: "display_instructions",
    render: ["inline"],
    data: {
      kind: "bank_transfer",
      bank_transfer: {
        account_number: "123456",
        account_number_label: "Account number",
        reference: "ord_1",
        beneficiary_name: "Redline Labs",
      },
    },
  });
  assert.equal(instructions?.kind, "bank_transfer");
  if (instructions?.kind === "bank_transfer") {
    assert.deepEqual(instructions.rows.map((row) => row.value), ["123456", "Redline Labs", "ord_1"]);
  }
  assert.equal(
    readNextAction({
      type: "await_confirmation",
      render: ["inline"],
      data: { expires_at: "2026-09-26T12:00:00.000Z" },
    })?.kind,
    "await_confirmation",
  );
});
