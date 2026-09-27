import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { priceSubtotal } from "./promo.ts";
import { centsToAud, whopCheckoutBody } from "./whop-pricing.ts";
import { whopApiBase, whopEnvironment } from "./whop-env.ts";

type CatalogProduct = {
  slug: string;
  variants: Array<{ option: string; price: number }>;
};

const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
) as CatalogProduct[];

test("cents become a two-decimal AUD amount", () => {
  assert.equal(centsToAud(18000), 180);
  assert.equal(centsToAud(25650), 256.5);
  assert.equal(centsToAud(10), 0.1);
});

test("an inline checkout prices AUD from the server total and attaches orderId", () => {
  const body = whopCheckoutBody({
    companyId: "biz_test",
    reference: "RL-234567",
    totalCents: 18000,
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-234567",
  });
  assert.equal(body.account_id, "biz_test");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.plan.three_ds_level, "frictionless_if_required");
  assert.deepEqual(body.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(body.metadata.orderId, "RL-234567");
  assert.equal(body.redirect_url, "https://redlinelabs.shop/checkout/return/RL-234567");
});

test("a $285 catalogue order takes 10 percent off and ignores a $1 browser price", () => {
  const dsip = products.find((product) => product.slug === "dsip");
  const tenMg = dsip?.variants.find((variant) => variant.option === "10");
  assert.equal(tenMg?.price, 95);
  const catalogueCents = Math.round((tenMg?.price ?? 0) * 100) * 3;
  const browserCents = 1 * 3;
  const priced = priceSubtotal(catalogueCents, null);
  assert.equal(catalogueCents, 28500);
  assert.equal(priced.volumeDiscountCents, 2850);
  assert.equal(priced.totalCents, 25650);
  assert.notEqual(priceSubtotal(browserCents, null).totalCents, priced.totalCents);
  const body = whopCheckoutBody({
    companyId: "biz_test",
    reference: "RL-234567",
    totalCents: priced.totalCents,
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-234567",
  });
  assert.equal(body.plan.initial_price, 256.5);
});

test("Whop stays on the sandbox API until WHOP_ENV asks for live", () => {
  assert.equal(whopEnvironment({}), "sandbox");
  assert.equal(whopApiBase({}), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopEnvironment({ WHOP_ENV: "live" }), "production");
  assert.equal(whopApiBase({ WHOP_ENV: "production" }), "https://api.whop.com/api/v1");
});
