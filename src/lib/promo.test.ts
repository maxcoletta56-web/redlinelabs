import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_PROMO,
  activePromo,
  applyPercentOff,
  checkoutTotals,
  lookupPromo,
  normalizePromoCode,
  promoDiscountCents,
  stripeCouponParams,
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
  assert.equal(activePromo(null), AUTO_PROMO);
  assert.equal(activePromo(""), AUTO_PROMO);
  assert.equal(activePromo("DGC20"), AUTO_PROMO);
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

test("creates a 20 percent coupon for DGC20 on the order total", () => {
  const promo = lookupPromo("DGC20");
  assert.deepEqual(stripeCouponParams({ promo, promoOffCents: 4400, storeCreditCents: 0 }), {
    percent_off: 20,
    duration: "once",
    name: "DGC20",
  });
  assert.deepEqual(
    stripeCouponParams({ promo, promoOffCents: 4400, storeCreditCents: 1000 }),
    {
      amount_off: 5400,
      currency: "aud",
      duration: "once",
      name: "DGC20 + Store credit",
    },
  );
  assert.equal(stripeCouponParams({ promo: null, promoOffCents: 0, storeCreditCents: 0 }), null);
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
