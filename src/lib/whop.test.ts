import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { orderTotalsFromCents } from "./promo.ts";
import {
  buildWhopCheckoutBody,
  centsToWhopPrice,
  checkoutReturnUrl,
  originFromHeaders,
  readWhopPaymentNotice,
  verifyWhopWebhook,
  webhookSigningKey,
  whopApiBase,
  whopEnvironment,
} from "./whop.ts";

test("sandbox is the default Whop environment", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopEnvironment({ WHOP_ENV: "production" }), "production");
  assert.equal(whopApiBase("sandbox"), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBase("production"), "https://api.whop.com/api/v1");
});

test("inline checkout price is the server total in AUD, with the order id attached", () => {
  const totals = orderTotalsFromCents(20_000, null);
  assert.equal(totals.catalogCents, 20_000);
  assert.equal(totals.volumeDiscountCents, 2_000);
  assert.equal(totals.discountedCents, 18_000);
  assert.equal(centsToWhopPrice(totals.discountedCents), 180);

  const body = buildWhopCheckoutBody({
    companyId: "biz_test",
    reference: "RL-234567",
    totalCents: totals.discountedCents,
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-234567",
  });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.three_ds_level, "frictionless_if_required");
  assert.deepEqual(body.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(body.metadata.orderId, "RL-234567");
  assert.equal(body.mode, "payment");
  assert.equal("price" in body, false);
});

test("return url keeps the order reference for the 3DS round trip", () => {
  const headers = new Headers({ host: "redlinelabs.shop", "x-forwarded-proto": "https" });
  assert.equal(
    checkoutReturnUrl(originFromHeaders(headers, "http://127.0.0.1:3000"), "RL-234567"),
    "https://redlinelabs.shop/checkout/return/RL-234567",
  );
});

test("webhook signatures use the raw body and reject stale or forged events", () => {
  const secret = "ws_test_secret";
  const rawBody = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_1234", metadata: { orderId: "RL-234567" } },
  });
  const webhookId = "msg_123";
  const timestamp = "1700000000";
  const signature = createHmac("sha256", webhookSigningKey(secret))
    .update(`${webhookId}.${timestamp}.${rawBody}`)
    .digest("base64");
  const nowMs = 1_700_000_000_000;
  assert.deepEqual(
    verifyWhopWebhook({
      rawBody,
      webhookId,
      timestamp,
      signature: `v1,${signature}`,
      secret,
      nowMs,
    }),
    { ok: true },
  );
  assert.equal(
    verifyWhopWebhook({
      rawBody: `${rawBody} `,
      webhookId,
      timestamp,
      signature: `v1,${signature}`,
      secret,
      nowMs,
    }).ok,
    false,
  );
  assert.equal(
    verifyWhopWebhook({
      rawBody,
      webhookId,
      timestamp,
      signature: `v1,${signature}`,
      secret,
      nowMs: nowMs + 6 * 60 * 1000,
    }).reason,
    "expired",
  );
  assert.equal(readWhopPaymentNotice(JSON.parse(rawBody)).type, "payment.succeeded");
  const notice = readWhopPaymentNotice(JSON.parse(rawBody));
  assert.equal("paymentId" in notice && notice.paymentId, "pay_1234");
  assert.equal("orderId" in notice && notice.orderId, "RL-234567");
  assert.deepEqual(readWhopPaymentNotice({ type: "membership.activated", data: {} }), {
    ignore: true,
  });
});
