import assert from "node:assert/strict";
import test from "node:test";
import { formatShippingAddress } from "./order-shipping.ts";

test("admin and order surfaces render a null shipping address without throwing", () => {
  assert.doesNotThrow(() => {
    assert.equal(formatShippingAddress(null), "No address on file");
    assert.equal(formatShippingAddress(undefined), "No address on file");
    assert.equal(formatShippingAddress({ line1: "   " }), "No address on file");
  });
});

test("a stored address formats as line, suburb, and country", () => {
  assert.equal(
    formatShippingAddress({
      line1: "1 Laboratory Road",
      line2: "Unit 2",
      city: "Sydney",
      state: "NSW",
      postcode: "2000",
      country: "AU",
    }),
    "1 Laboratory Road\nUnit 2\nSydney NSW 2000\nAU",
  );
  assert.equal(
    formatShippingAddress({
      line1: "9 Dock Street",
      line2: "",
      city: "Hobart",
      state: "TAS",
      postcode: "7000",
      country: "AU",
    }),
    "9 Dock Street\nHobart TAS 7000\nAU",
  );
});
