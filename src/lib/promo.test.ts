import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPercentOff,
  checkoutTotals,
  lookupPromo,
  normalizePromoCode,
  promoDiscountCents,
  quoteFromSubtotal,
} from "./promo.ts";
import { creditToApplyCents } from "./store-credit.ts";

test("DGC20 is a 20 percent checkout code", () => {
  const promo = lookupPromo("dgc20");
  assert.deepEqual(promo, {
    code: "DGC20",
    percentOff: 20,
    name: "20% off order total",
  });
  assert.equal(normalizePromoCode("  dgc20  "), "DGC20");
  assert.equal(lookupPromo("SAVE20"), null);
  assert.equal(lookupPromo(""), null);
});

test("FAMILY70 is a 70 percent checkout code", () => {
  const promo = lookupPromo("family70");
  assert.deepEqual(promo, {
    code: "FAMILY70",
    percentOff: 70,
    name: "70% off order total",
  });
  assert.deepEqual(lookupPromo("FAMILY70"), promo);
  assert.equal(applyPercentOff(10000, 70), 3000);
  assert.equal(promoDiscountCents(10000, promo), 7000);

  const totals = checkoutTotals({
    items: [{ price: 100, qty: 1 }],
    promo,
  });
  assert.equal(totals.catalogCents, 10000);
  assert.equal(totals.discountedCents, 3000);
  assert.equal(totals.discountCents, 7000);
});

test("takes 20 percent off the order total, not each line", () => {
  assert.equal(applyPercentOff(8900, 20), 7120);
  assert.equal(promoDiscountCents(8900, lookupPromo("DGC20")), 1780);
  assert.equal(promoDiscountCents(8900, null), 0);

  const perLine = applyPercentOff(3333, 20) * 2;
  const orderTotal = applyPercentOff(6666, 20);
  assert.equal(perLine, 5332);
  assert.equal(orderTotal, 5333);

  const totals = checkoutTotals({
    items: [
      { price: 33.33, qty: 1 },
      { price: 33.33, qty: 1 },
    ],
    promo: lookupPromo("DGC20"),
  });
  assert.equal(totals.catalogCents, 6666);
  assert.equal(totals.discountedCents, orderTotal);
  assert.equal(totals.discountCents, 1333);
});

test("orders of $200 or more take 10 percent off before a coupon", () => {
  assert.equal(quoteFromSubtotal(19_999, null).volumeCents, 0);
  assert.equal(quoteFromSubtotal(19_999, null).discountedCents, 19_999);
  const volumeOnly = quoteFromSubtotal(20_000, null);
  assert.equal(volumeOnly.volumeCents, 2_000);
  assert.equal(volumeOnly.discountedCents, 18_000);
  const stacked = quoteFromSubtotal(20_000, lookupPromo("DGC20"));
  assert.equal(stacked.volumeCents, 2_000);
  assert.equal(stacked.promoCents, 3_600);
  assert.equal(stacked.discountedCents, 14_400);
});

test("applies store credit after 20 percent off the total", () => {
  const totals = checkoutTotals({
    items: [
      { price: 89, qty: 2 },
      { price: 125, qty: 1 },
    ],
    promo: lookupPromo("DGC20"),
  });
  assert.equal(totals.catalogCents, 30300);
  assert.equal(totals.discountedCents, 24240);
  assert.equal(totals.discountCents, 6060);
  const creditCents = creditToApplyCents(1000, totals.discountedCents);
  assert.equal(creditCents, 1000);
  assert.equal(totals.discountedCents - creditCents, 23240);
});
