import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { optionLabel, variantGroupLabel } from "./variant-label.ts";

type CatalogProduct = {
  slug: string;
  sku: string;
  image: string;
  description: string;
  categories: string[];
  variants: Array<{ option: string; sku: string }>;
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
    products.some((product) =>
      product.categories.some((category) =>
        ["LAB SUPPLIES", "ACCESSORIES"].includes(category),
      ),
    ),
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

test("Selank, Semax, DSIP, and Melanotan 2 offer a nasal spray option", () => {
  const slugs = [
    "products-selank",
    "products-semax",
    "products-dsip",
    "melanotan-2",
  ];
  for (const slug of slugs) {
    const product = products.find((entry) => entry.slug === slug);
    assert.ok(product, `${slug} is missing`);
    assert.ok(
      product.variants.some((variant) => variant.option === "Nasal Spray"),
      `${slug} is missing a Nasal Spray variant`,
    );
  }
  const melanotan = products.find((entry) => entry.slug === "melanotan-2");
  assert.ok(melanotan?.variants.some((variant) => variant.option === "Vial"));
});

test("form options keep their own labels instead of a dose unit", () => {
  assert.equal(optionLabel({ variantLabel: "MG" }, "10"), "10 MG");
  assert.equal(optionLabel({ variantLabel: "MG" }, "Nasal Spray"), "Nasal Spray");
  assert.equal(optionLabel({ variantLabel: null }, "Vial"), "Vial");
  assert.equal(
    variantGroupLabel({
      variantLabel: "MG",
      variants: [
        { option: "10", price: 90, sku: "Selank10" },
        { option: "Nasal Spray", price: 90, sku: "SelankNS" },
      ],
    }),
    "Option",
  );
});
