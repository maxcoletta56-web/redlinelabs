import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createMemoryOrderStore, type StoredOrder } from "./orders.ts";
import { handleWhopWebhook, parseWhopEvent, verifyWhopSignature, WebhookSignatureError } from "./whop-webhook.ts";

const secret = "ws_test_secret";
const now = 1_700_000_000;

function sign(body: string, timestamp = String(now)) {
  const id = "msg_test";
  const mac = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${mac}`,
  });
}

function payload(type: "payment.succeeded" | "payment.failed", paymentId: string, orderId: string) {
  return JSON.stringify({
    id: "msg_test",
    type,
    data: { id: paymentId, metadata: { orderId } },
  });
}

async function pendingOrder(store: ReturnType<typeof createMemoryOrderStore>) {
  return store.insert({
    id: "ord_aaaaaaaaaaaaaaaaaaaaaaaa",
    email: "buyer@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    currency: "aud",
    subtotalCents: 22000,
    volumeDiscountCents: 2200,
    promoCode: "",
    promoDiscountCents: 0,
    totalCents: 19800,
    lines: [],
    shipping: null,
    paymentMethod: "card",
  });
}

test("accepts a signature over the raw body and rejects a stale or forged one", () => {
  const body = payload("payment.succeeded", "pay_123", "ord_aaaaaaaaaaaaaaaaaaaaaaaa");
  verifyWhopSignature({ rawBody: body, headers: sign(body), secret, now });
  assert.throws(
    () => verifyWhopSignature({ rawBody: body, headers: sign(body, String(now - 600)), secret, now }),
    WebhookSignatureError,
  );
  assert.throws(
    () => verifyWhopSignature({ rawBody: body, headers: sign(`${body} `), secret, now }),
    WebhookSignatureError,
  );
});

test("reads orderId from payment metadata", () => {
  const event = parseWhopEvent(JSON.parse(payload("payment.failed", "pay_9", "ord_abc")));
  assert.deepEqual(event, { type: "payment.failed", paymentId: "pay_9", orderId: "ord_abc" });
  assert.deepEqual(parseWhopEvent({ type: "membership.went_valid", data: { id: "mem_1" } }), {
    type: "ignored",
  });
});

test("marks paid once, sends one email, and marks failed without email", async () => {
  const store = createMemoryOrderStore();
  const order = await pendingOrder(store);
  const sent: StoredOrder[] = [];
  const sendEmail = async (paid: StoredOrder) => {
    sent.push(paid);
  };
  const body = payload("payment.succeeded", "pay_123", order.id);
  const first = await handleWhopWebhook({
    rawBody: body,
    headers: sign(body),
    secret,
    now,
    store,
    sendEmail,
  });
  const second = await handleWhopWebhook({
    rawBody: body,
    headers: sign(body),
    secret,
    now,
    store,
    sendEmail,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.status, "paid");
  assert.equal(second.body.duplicate, true);
  assert.equal(sent.length, 1);
  assert.equal((await store.get(order.id))?.status, "paid");
  assert.equal((await store.get(order.id))?.whopPaymentId, "pay_123");

  const failedStore = createMemoryOrderStore();
  const failedOrder = await pendingOrder(failedStore);
  const failedBody = payload("payment.failed", "pay_fail", failedOrder.id);
  let emails = 0;
  const failed = await handleWhopWebhook({
    rawBody: failedBody,
    headers: sign(failedBody),
    secret,
    now,
    store: failedStore,
    sendEmail: async () => {
      emails += 1;
    },
  });
  const failedAgain = await handleWhopWebhook({
    rawBody: failedBody,
    headers: sign(failedBody),
    secret,
    now,
    store: failedStore,
    sendEmail: async () => {
      emails += 1;
    },
  });
  assert.equal(failed.body.status, "failed");
  assert.equal(failedAgain.body.duplicate, true);
  assert.equal(emails, 0);
  assert.equal((await failedStore.get(failedOrder.id))?.status, "failed");
});

test("retries the confirmation email when the first send fails", async () => {
  const store = createMemoryOrderStore();
  const order = await pendingOrder(store);
  const body = payload("payment.succeeded", "pay_retry", order.id);
  let attempts = 0;
  const first = await handleWhopWebhook({
    rawBody: body,
    headers: sign(body),
    secret,
    now,
    store,
    sendEmail: async () => {
      attempts += 1;
      throw new Error("Confirmation email is not configured");
    },
  });
  const second = await handleWhopWebhook({
    rawBody: body,
    headers: sign(body),
    secret,
    now,
    store,
    sendEmail: async () => {
      attempts += 1;
    },
  });
  assert.equal(first.status, 500);
  assert.equal(second.status, 200);
  assert.equal(attempts, 2);
  assert.equal((await store.get(order.id))?.status, "paid");
});
