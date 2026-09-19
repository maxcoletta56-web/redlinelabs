import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type CatalogProduct = {
  slug: string;
  sku: string;
  image: string;
  description: string;
  categories: string[];
  variants: Array<{ sku: string }>;
};

const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
) as CatalogProduct[];

test("every listing has a SKU and unique slugs", () => {
  const slugs = products.map((product) => product.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const product of products) {
    assert.ok(product.sku.trim(), `${product.slug} is missing a SKU`);
    assert.ok(product.image, `${product.slug} is missing an image`);
    assert.ok(product.description, `${product.slug} is missing a description`);
  }
});

test("lab accessories are not listed", () => {
  assert.equal(
    products.some((product) => product.slug === "product-bacterial-water"),
    false,
  );
  assert.equal(
    products.some((product) => product.categories.includes("LAB SUPPLIES")),
    false,
  );
});

test("variant SKUs are unique on each listing", () => {
  for (const product of products) {
    const skus = product.variants.map((variant) => variant.sku);
    assert.equal(
      new Set(skus).size,
      skus.length,
      `${product.slug} reuses a variant SKU`,
    );
  }
});
