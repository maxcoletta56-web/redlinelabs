import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { whopChargeCents } from "./promo-pricing.ts";
import { lookupPromo } from "./promo.ts";
import {
  audMajorUnits,
  readWhopCheckoutConfiguration,
  resolveWhop,
  verifyWhopSignature,
  WhopSignatureError,
  whopCheckoutConfigurationBody,
  whopMode,
} from "./whop.ts";

test("card totals take 10 percent off at $200, then any promo", () => {
  assert.equal(whopChargeCents(19_999, null).totalCents, 19_999);
  assert.equal(whopChargeCents(19_999, null).volumeDiscountCents, 0);
  const twoHundred = whopChargeCents(20_000, null);
  assert.equal(twoHundred.volumeDiscountCents, 2_000);
  assert.equal(twoHundred.totalCents, 18_000);

  const withPromo = whopChargeCents(34_000, lookupPromo("DGC20"));
  assert.equal(withPromo.volumeDiscountCents, 3_400);
  assert.equal(withPromo.promoDiscountCents, 6_120);
  assert.equal(withPromo.totalCents, 24_480);
});

test("inline Whop pricing is AUD from the server total", () => {
  assert.equal(audMajorUnits(30_600), 306);
  const body = whopCheckoutConfigurationBody({
    reference: "RL-7F3K2Q",
    totalCents: 30_600,
    redirectUrl: "https://redlinelabs.shop/order/RL-7F3K2Q?whop=return",
    accountId: "biz_test",
  });
  assert.equal(body.currency, "aud");
  assert.equal(body.mode, "payment");
  assert.deepEqual(body.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(body.variant.currency, "aud");
  assert.equal(body.variant.initial_price, 306);
  assert.equal(body.variant.billing_type, "one_time");
  assert.equal(body.variant.three_ds_level, "mandate_if_required");
  assert.equal(body.variant.force_create_new_plan, true);
  assert.equal(body.account_id, "biz_test");
  assert.equal("price" in body, false);
});

test("checkout configuration ids are read from the Whop response", () => {
  assert.deepEqual(
    readWhopCheckoutConfiguration({
      id: "ch_order",
      variant: { id: "plan_order" },
    }),
    { id: "ch_order", planId: "plan_order" },
  );
  assert.equal(readWhopCheckoutConfiguration({ id: "ch_order" }), null);
  assert.equal(readWhopCheckoutConfiguration({ id: "not-a-checkout", variant: { id: "plan_x" } }), null);
});

test("Whop stays in sandbox until WHOP_ENV=production", () => {
  assert.equal(whopMode(undefined), "sandbox");
  assert.equal(whopMode("sandbox"), "sandbox");
  assert.equal(whopMode("production"), "production");
  const sandbox = resolveWhop({ WHOP_API_KEY: "apik_test", WHOP_WEBHOOK_SECRET: "ws_test" });
  assert.equal(sandbox?.mode, "sandbox");
  assert.equal(sandbox?.baseUrl, "https://sandbox-api.whop.com/api/v1");
  assert.equal(resolveWhop({}), null);
  const live = resolveWhop({ WHOP_API_KEY: "apik_live", WHOP_ENV: "production" });
  assert.equal(live?.baseUrl, "https://api.whop.com/api/v1");
});

test("webhook signatures use the raw secret and reject stale or forged bodies", () => {
  const secret = "ws_test_secret";
  const payload = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_123" } });
  const timestamp = "1760000000";
  const id = "msg_1";
  const signature = createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  const headers = new Headers({
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  });
  const verified = verifyWhopSignature(payload, headers, secret, 1_760_000_000_000);
  assert.equal((verified as { type: string }).type, "payment.succeeded");

  assert.throws(
    () => verifyWhopSignature(payload, headers, "ws_other", 1_760_000_000_000),
    WhopSignatureError,
  );
  assert.throws(
    () => verifyWhopSignature(`${payload} `, headers, secret, 1_760_000_000_000),
    WhopSignatureError,
  );
  assert.throws(
    () => verifyWhopSignature(payload, headers, secret, 1_760_000_000_000 + 6 * 60 * 1000),
    WhopSignatureError,
  );
});
