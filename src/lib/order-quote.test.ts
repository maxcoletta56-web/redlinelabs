import assert from "node:assert/strict";
import test from "node:test";
import { lookupPromo } from "./promo.ts";
import {
  explainChargedTotal,
  quoteDisplayedCart,
  quoteOrder,
  volumeDiscountCents,
} from "./order-quote.ts";

test("orders under $200 do not take the volume discount", () => {
  assert.equal(volumeDiscountCents(19999), 0);
  const quote = quoteOrder(19999, null);
  assert.equal(quote.totalCents, 19999);
  assert.equal(quote.volumeDiscountCents, 0);
});

test("orders of $200 or more take 10 percent off before a coupon", () => {
  assert.equal(volumeDiscountCents(20000), 2000);
  const quoted = quoteOrder(24500, null);
  assert.equal(quoted.volumeDiscountCents, 2450);
  assert.equal(quoted.totalCents, 22050);

  const withCoupon = quoteOrder(24500, lookupPromo("DGC20"));
  assert.equal(withCoupon.volumeDiscountCents, 2450);
  assert.equal(withCoupon.promoDiscountCents, 4410);
  assert.equal(withCoupon.totalCents, 17640);
});

test("the displayed cart quote uses dollar prices already on the line", () => {
  const quote = quoteDisplayedCart([{ price: 245, qty: 1 }], null);
  assert.equal(quote.subtotalCents, 24500);
  assert.equal(quote.totalCents, 22050);
});

test("a stored total that predates the volume discount stays one combined line", () => {
  const legacy = explainChargedTotal(20000, 16000, lookupPromo("DGC20"));
  assert.equal(legacy.matches, false);
  assert.equal(legacy.promoDiscountCents, 4000);
});
