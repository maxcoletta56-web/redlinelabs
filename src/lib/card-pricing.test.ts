import assert from "node:assert/strict";
import test from "node:test";
import { priceCardCart, volumeDiscountCents } from "./card-pricing.ts";

test("orders under $200 are not volume discounted", () => {
  assert.equal(volumeDiscountCents(19_999), 0);
  assert.equal(priceCardCart(19_999, null).totalCents, 19_999);
});

test("orders of $200 or more take 10% off the catalogue subtotal", () => {
  assert.equal(volumeDiscountCents(20_000), 2_000);
  assert.equal(priceCardCart(20_000, null).totalCents, 18_000);
  assert.equal(priceCardCart(22_000, null).totalCents, 19_800);
});

test("a promo and the volume discount both reduce the card total", () => {
  const priced = priceCardCart(22_000, {
    code: "DGC20",
    percentOff: 20,
    name: "20% off order total",
  });
  assert.equal(priced.promoOffCents, 4_400);
  assert.equal(priced.volumeOffCents, 2_200);
  assert.equal(priced.totalCents, 15_400);
  assert.equal(priced.promoCode, "DGC20");
});

test("the combined discount cannot exceed the subtotal", () => {
  const priced = priceCardCart(20_000, {
    code: "FAMILY70",
    percentOff: 100,
    name: "all",
  });
  assert.equal(priced.totalCents, 0);
});
