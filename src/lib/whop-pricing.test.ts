import assert from "node:assert/strict";
import test from "node:test";
import { priceCardOrder } from "./whop-pricing.ts";
import { cardPayableCents, volumeDiscountCents } from "./promo-pricing.ts";

test("orders under $200 are not volume discounted", () => {
  assert.equal(volumeDiscountCents(19_999), 0);
  assert.equal(cardPayableCents(19_999, null).totalCents, 19_999);
});

test("orders of $200 or more take 10% off before a promo", () => {
  assert.equal(volumeDiscountCents(20_000), 2_000);
  const priced = cardPayableCents(20_000, { code: "DGC20", percentOff: 20, name: "20% off" });
  assert.equal(priced.volumeDiscountCents, 2_000);
  assert.equal(priced.promoDiscountCents, 3_600);
  assert.equal(priced.totalCents, 14_400);
});

test("card pricing ignores a price sent with the cart line", () => {
  const priced = priceCardOrder(
    [{ slug: "retatrutide", option: "10", qty: 2, price: 1 } as never],
    null,
  );
  assert.equal(priced.subtotalCents, 20_000);
  assert.equal(priced.volumeDiscountCents, 2_000);
  assert.equal(priced.totalCents, 18_000);
  assert.equal(priced.lines[0]?.unitAmountCents, 10_000);
});
