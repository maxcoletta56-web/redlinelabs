import assert from "node:assert/strict";
import test from "node:test";
import { quoteCart } from "./cart-quote.ts";

test("ignores a browser price and applies 10 percent at $200", () => {
  const quote = quoteCart(
    [{ slug: "bacterial-water", option: "10", qty: 20, price: 1 } as { slug: string; option: string; qty: number }],
    null,
  );
  assert.equal(quote.subtotalCents, 20000);
  assert.equal(quote.volumeDiscountCents, 2000);
  assert.equal(quote.totalCents, 18000);
  assert.equal(quote.lines[0]?.unitAmountCents, 1000);
});

test("leaves orders under $200 undiscounted by volume", () => {
  const quote = quoteCart([{ slug: "bacterial-water", option: "10", qty: 19 }], null);
  assert.equal(quote.subtotalCents, 19000);
  assert.equal(quote.volumeDiscountCents, 0);
  assert.equal(quote.totalCents, 19000);
});

test("applies a promo after the volume discount", () => {
  const quote = quoteCart([{ slug: "bacterial-water", option: "10", qty: 20 }], "dgc20");
  assert.equal(quote.volumeDiscountCents, 2000);
  assert.equal(quote.promoDiscountCents, 3600);
  assert.equal(quote.totalCents, 14400);
});
