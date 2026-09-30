import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { COMPANY_NUMBER } from "./company.ts";
import { llmsText } from "./llms.ts";

test("llms.txt names the company and links the catalogue without prices", () => {
  const text = llmsText();
  const products = JSON.parse(
    readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
  ) as Array<{ slug: string }>;
  assert.match(text, new RegExp(COMPANY_NUMBER));
  assert.match(text, /https:\/\/redlinelabs\.shop\/faq/);
  assert.match(text, /research use only/i);
  assert.equal(text.includes("$"), false);
  for (const product of products) {
    assert.match(text, new RegExp(`/product/${product.slug}`));
  }
});
