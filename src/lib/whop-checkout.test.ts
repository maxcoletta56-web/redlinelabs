import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createFileOrderStore, memoryOrderStore } from "./order-store.ts";
import { prepareCheckout } from "./prepare-checkout.ts";
import { createPendingOrder } from "./server-order.ts";
import { quoteCart } from "./cart-quote.ts";
import {
  checkoutConfigurationBody,
  resolveWhop,
  resolveWhopEnvironment,
} from "./whop-config.ts";
import { handleWhopWebhook, verifyWhopSignature, WebhookSignatureError } from "./whop-webhook.ts";

const secret = "test_webhook_secret";

function signedHeaders(body: string, timestamp: number, key = secret) {
  const id = "msg_test";
  const signature = createHmac("sha256", Buffer.from(key, "utf8"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  });
}

test("sandbox is the default Whop environment and the key stays off the body", () => {
  assert.equal(resolveWhopEnvironment({}), "sandbox");
  assert.equal(resolveWhopEnvironment({ WHOP_ENV: "production" }), "production");
  assert.equal(resolveWhop({ WHOP_API_KEY: "key" }), undefined);
  const resolved = resolveWhop({ WHOP_API_KEY: " sandbox-key ", WHOP_COMPANY_ID: " biz_123 " });
  assert.equal(resolved?.apiOrigin, "https://sandbox-api.whop.com/api/v1");
  assert.equal(resolved?.apiKey, "sandbox-key");

  const body = checkoutConfigurationBody({
    companyId: "biz_123",
    orderId: "rl_abc",
    totalCents: 18000,
    redirectUrl: "https://redlinelabs.shop/checkout/success?order_id=rl_abc",
  });
  assert.equal(body.metadata.orderId, "rl_abc");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.three_ds_level, "frictionless_if_required");
  assert.equal(JSON.stringify(body).includes("sandbox-key"), false);
});

test("card checkout charges the catalogue total, not a browser price", async () => {
  const store = memoryOrderStore();
  let charged = 0;
  const prepared = await prepareCheckout(
    {
      items: [{ slug: "bacterial-water", option: "10", qty: 20 }],
      email: "max@example.com",
      ageConfirmed: true,
      researchUse: true,
      paymentMethod: "card",
    },
    {
      store,
      orderId: "rl_volumeorder000000000001",
      bankDetails: { accountName: null, bsb: null, accountNumber: null },
      returnUrlFor: (orderId) => `https://redlinelabs.shop/checkout/success?order_id=${orderId}`,
      createCardCheckout: async (order) => {
        charged = order.totalCents;
        return { planId: "plan_test", sessionId: "ch_test", environment: "sandbox" };
      },
    },
  );
  assert.equal(charged, 18000);
  assert.equal(prepared.method, "card");
  if (prepared.method === "card") {
    assert.equal(prepared.environment, "sandbox");
    assert.equal(prepared.sessionId, "ch_test");
  }
  const saved = await store.get("rl_volumeorder000000000001");
  assert.equal(saved?.status, "pending");
  assert.equal(saved?.whopCheckoutId, "ch_test");
});

test("bank transfer keeps the order pending without calling Whop", async () => {
  const store = memoryOrderStore();
  let called = false;
  const prepared = await prepareCheckout(
    {
      items: [{ slug: "bacterial-water", option: "10", qty: 1 }],
      email: "max@example.com",
      ageConfirmed: true,
      researchUse: true,
      paymentMethod: "bank_transfer",
    },
    {
      store,
      orderId: "rl_bankorder0000000000001",
      bankDetails: { accountName: "Redline Labs", bsb: "000-000", accountNumber: "12345678" },
      returnUrlFor: () => "https://redlinelabs.shop/checkout/success",
      createCardCheckout: async () => {
        called = true;
        return { planId: "plan_test", sessionId: "ch_test", environment: "sandbox" };
      },
    },
  );
  assert.equal(called, false);
  assert.equal(prepared.method, "bank_transfer");
  assert.equal((await store.get("rl_bankorder0000000000001"))?.status, "pending");
  assert.equal((await store.get("rl_bankorder0000000000001"))?.totalCents, 1000);
});

test("webhook marks paid once and sends one confirmation email", async () => {
  const quote = quoteCart([{ slug: "bacterial-water", option: "10", qty: 1 }], null);
  const order = createPendingOrder({
    id: "rl_webhook000000000000001",
    quote,
    email: "max@example.com",
    paymentMethod: "card",
  });
  const store = memoryOrderStore([order]);
  const now = 1_700_000_000;
  const body = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_123", metadata: { orderId: order.id } },
  });
  let emails = 0;
  const first = await handleWhopWebhook({
    rawBody: body,
    headers: signedHeaders(body, now),
    secret,
    now,
    store,
    sendEmail: async () => {
      emails += 1;
    },
  });
  const second = await handleWhopWebhook({
    rawBody: body,
    headers: signedHeaders(body, now),
    secret,
    now,
    store,
    sendEmail: async () => {
      emails += 1;
    },
  });
  assert.equal(first.status, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(emails, 1);
  assert.equal((await store.get(order.id))?.status, "paid");
  assert.equal((await store.get(order.id))?.appliedPayments.pay_123, "paid");
});

test("payment.failed marks the order failed and a bad signature does not", async () => {
  const quote = quoteCart([{ slug: "bacterial-water", option: "10", qty: 1 }], null);
  const order = createPendingOrder({
    id: "rl_failed0000000000000001",
    quote,
    email: "max@example.com",
    paymentMethod: "card",
  });
  const store = memoryOrderStore([order]);
  const now = 1_700_000_000;
  const body = JSON.stringify({
    type: "payment.failed",
    data: { id: "pay_fail", metadata: { orderId: order.id } },
  });
  assert.throws(
    () =>
      verifyWhopSignature({
        rawBody: body,
        headers: signedHeaders(body, now, "other-secret"),
        secret,
        now,
      }),
    WebhookSignatureError,
  );
  assert.equal((await store.get(order.id))?.status, "pending");
  const result = await handleWhopWebhook({
    rawBody: body,
    headers: signedHeaders(body, now),
    secret,
    now,
    store,
    sendEmail: async () => {
      throw new Error("should not email");
    },
  });
  assert.equal(result.status, 200);
  assert.equal((await store.get(order.id))?.status, "failed");
});

test("persists orders in the file store", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "rl-orders-"));
  try {
    const store = createFileOrderStore(path.join(directory, "orders.json"));
    const quote = quoteCart([{ slug: "bacterial-water", option: "10", qty: 1 }], null);
    const order = createPendingOrder({
      id: "rl_file000000000000000001",
      quote,
      email: "max@example.com",
      paymentMethod: "bank_transfer",
    });
    await store.put(order);
    const raw = await readFile(path.join(directory, "orders.json"), "utf8");
    assert.equal(raw.includes("WHOP_API_KEY"), false);
    assert.equal((await store.get(order.id))?.status, "pending");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
