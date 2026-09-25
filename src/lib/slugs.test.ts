import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PRODUCT_SLUG_REDIRECTS, canonicalProductSlug } from "./slugs.ts";

const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
) as Array<{ slug: string }>;

test("catalogue slugs are kebab-case without product(s) prefixes", () => {
  for (const product of products) {
    assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.doesNotMatch(product.slug, /^products?-/);
  }
});

test("legacy slugs map to current catalogue slugs", () => {
  const current = new Set(products.map((product) => product.slug));
  for (const [from, to] of Object.entries(PRODUCT_SLUG_REDIRECTS)) {
    assert.notEqual(from, to);
    assert.ok(current.has(to), `${from} redirects to missing slug ${to}`);
    assert.equal(canonicalProductSlug(from), to);
  }
});
