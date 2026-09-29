import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { resolveCartLines } from "./order.ts";
import { priceCatalogue } from "./promo-pricing.ts";
import { parseCheckoutBody } from "./validation.ts";
import {
  centsToAud,
  readWhopPaymentEvent,
  verifyWhopWebhook,
  whopApiBase,
  whopCheckoutBody,
  whopEmbedEnvironment,
  whopMode,
} from "./whop.ts";

function sign(secret: string, id: string, timestamp: string, body: string) {
  const digest = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${digest}`;
}

test("sandbox is the default and live is explicit", () => {
  assert.equal(whopMode({}), "sandbox");
  assert.equal(whopMode({ WHOP_ENV: "sandbox" }), "sandbox");
  assert.equal(whopEmbedEnvironment({}), "sandbox");
  assert.equal(whopApiBase({}), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopMode({ WHOP_ENV: "live" }), "live");
  assert.equal(whopEmbedEnvironment({ WHOP_ENV: "production" }), "production");
  assert.equal(whopApiBase({ WHOP_ENV: "live" }), "https://api.whop.com/api/v1");
});

test("checkout configuration prices the catalogue total in AUD and ignores a browser price", () => {
  const parsed = parseCheckoutBody({
    email: "ada@example.com",
    ageConfirmed: true,
    researchUse: true,
    items: [{ slug: "bpc-157", option: "10", qty: 3, price: 1 }],
    shipping: {
      name: "Ada Lovelace",
      line1: "1 Laboratory Road",
      city: "Sydney",
      state: "NSW",
      postal_code: "2000",
      country: "AU",
    },
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal("price" in parsed.data.items[0], false);

  const lines = resolveCartLines(parsed.data.items);
  const subtotal = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  assert.equal(subtotal, 26700);
  const priced = priceCatalogue(subtotal, null);
  assert.equal(priced.volumeDiscountCents, 2670);
  assert.equal(priced.totalCents, 24030);

  const body = whopCheckoutBody({
    totalCents: priced.totalCents,
    orderId: "RL-7F3K2Q",
    redirectUrl: "https://redlinelabs.shop/checkout/complete?order=RL-7F3K2Q",
    title: "Redline Labs RL-7F3K2Q",
    accountId: "biz_test",
  });
  assert.equal(body.currency, "aud");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(centsToAud(24030), 240.3);
  assert.equal(body.plan.initial_price === 1, false);
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.three_ds_level, "frictionless_if_required");
  assert.deepEqual(body.payment_method_configuration.enabled, ["card"]);
});

test("webhook signature accepts the raw secret and rejects a tampered body", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_123", metadata: { orderId: "RL-7F3K2Q" } },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = {
    "webhook-id": "msg_1",
    "webhook-timestamp": timestamp,
    "webhook-signature": sign(secret, "msg_1", timestamp, body),
  };
  const payload = verifyWhopWebhook(body, headers, secret);
  assert.deepEqual(readWhopPaymentEvent(payload), {
    type: "payment.succeeded",
    paymentId: "pay_123",
    orderId: "RL-7F3K2Q",
  });
  assert.throws(() => verifyWhopWebhook(`${body} `, headers, secret), /Invalid webhook signature/);
  assert.throws(
    () =>
      verifyWhopWebhook(body, { ...headers, "webhook-timestamp": "100" }, secret),
    /tolerance/,
  );
  assert.equal(readWhopPaymentEvent({ type: "membership.activated", data: { id: "mem_1" } }), null);
  assert.equal(
    readWhopPaymentEvent({ type: "payment.failed", data: { id: "pay_9", metadata: {} } }),
    null,
  );
});
