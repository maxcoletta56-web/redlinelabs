import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPercentOff,
  applyPercentOffDollars,
  applyPromoToUnitCents,
  checkoutTotals,
  lookupPromo,
  normalizePromoCode,
} from "./promo.ts";
import { creditToApplyCents } from "./store-credit.ts";

test("DGC20 is a 20 percent checkout code", () => {
  const promo = lookupPromo("dgc20");
  assert.deepEqual(promo, {
    code: "DGC20",
    percentOff: 20,
    name: "20% off all products",
  });
  assert.equal(normalizePromoCode("  dgc20  "), "DGC20");
  assert.equal(lookupPromo("SAVE20"), null);
  assert.equal(lookupPromo(""), null);
});

test("applies 20 percent off product prices in cents", () => {
  assert.equal(applyPercentOff(8900, 20), 7120);
  assert.equal(applyPercentOffDollars(89, 20), 71.2);
  assert.equal(applyPromoToUnitCents(12500, lookupPromo("DGC20")), 10000);
  assert.equal(applyPromoToUnitCents(12500, null), 12500);
});

test("discounts every line then applies store credit to the sale total", () => {
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
