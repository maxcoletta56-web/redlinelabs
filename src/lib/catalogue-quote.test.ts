import assert from "node:assert/strict";
import test from "node:test";
import { quoteCatalogueCart } from "./catalogue-quote.ts";

test("catalogue quote ignores a price sent with the cart line", () => {
  const quote = quoteCatalogueCart([
    { slug: "retatrutide", option: "30", qty: 1, price: 1 } as {
      slug: string;
      option: string;
      qty: number;
      price: number;
    },
  ]);
  assert.equal(quote.subtotalCents, 24500);
  assert.equal(quote.volumeDiscountCents, 2450);
  assert.equal(quote.totalCents, 22050);
  assert.equal(quote.lines[0]?.unitAmountCents, 24500);
});

test("a catalogue line under $200 is not discounted", () => {
  const quote = quoteCatalogueCart([{ slug: "dsip", option: "10", qty: 1 }]);
  assert.equal(quote.subtotalCents, 9500);
  assert.equal(quote.volumeDiscountCents, 0);
  assert.equal(quote.totalCents, 9500);
});
