import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { metaDescription, productMetaDescription } from "./seo.ts";

test("keeps a complete first sentence when it already fills the range", () => {
  const text =
    "Redline Labs lists laboratory research chemicals for purchase in Australia, with certificates of analysis available on request for the current catalogue.";
  assert.equal(metaDescription(text), text);
  assert.ok(metaDescription(text).length >= 140);
  assert.ok(metaDescription(text).length <= 155);
});

test("adds the next sentence when the first is too short", () => {
  const result = metaDescription(
    "Laboratory research chemicals shipped within Australia. For laboratory research use only, not for human or veterinary consumption.",
  );
  assert.match(result, /Australia/);
  assert.match(result, /research use only/);
});

test("truncates on a word boundary instead of mid-word", () => {
  const long =
    "This listing is a topical research formulation containing GHK copper tripeptide chelate, sodium hyaluronate, panthenol, and astaxanthin as labelled by the supplier.";
  const result = metaDescription(long);
  assert.ok(result.endsWith("…"));
  assert.ok(result.length <= 155);
  assert.equal(result.includes("supplier"), false);
});

test("product snippets stay within 155 characters and keep research-use wording", () => {
  const products = JSON.parse(
    readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
  ) as Array<{ name: string; description: string }>;
  for (const product of products) {
    const result = productMetaDescription(product.name, product.description);
    assert.ok(result.length <= 155, `${product.name} is ${result.length}`);
    assert.match(result, /laboratory research/i);
    assert.equal(result.endsWith("…"), false);
    assert.equal(metaDescription(result), result, product.name);
    assert.equal(result.includes(", for laboratory"), false);
  }
});
