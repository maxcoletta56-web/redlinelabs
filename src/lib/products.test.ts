import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { optionLabel, variantGroupLabel } from "./variant-label.ts";

type CatalogProduct = {
  name: string;
  slug: string;
  sku: string;
  image: string;
  description: string;
  categories: string[];
  variants: Array<{ option: string; sku: string; price: number }>;
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

test("bacterial water is listed as an accessory", () => {
  const water = products.find((product) => product.slug === "bacterial-water");
  assert.ok(water, "bacterial water is missing");
  assert.equal(water.name, "BACTERIAL WATER");
  assert.equal(water.sku, "Bac09");
  assert.ok(water.categories.includes("ACCESSORIES"));
  assert.equal(water.variants[0]?.option, "10");
  assert.equal(water.variants[0]?.price, 10);
  assert.match(water.description, /bacteriostatic/i);
  assert.match(water.description, /bac water/i);
  const haystack = [
    water.name,
    water.sku,
    water.slug.replaceAll("-", " "),
    water.description,
    ...water.categories,
  ]
    .join(" ")
    .toLowerCase();
  for (const query of [
    "bacterial water",
    "bacterial",
    "bac water",
    "bac",
    "bacteriostatic",
    "Bac09",
  ]) {
    assert.ok(
      query
        .toLowerCase()
        .split(/\s+/)
        .every((term) => haystack.includes(term)),
      `${query} should match bacterial water`,
    );
  }
});

test("insulin syringes and alcohol swabs are listed as accessories", () => {
  const syringes = products.find((product) => product.slug === "insulin-syringes");
  const swabs = products.find((product) => product.slug === "alcohol-swabs");
  assert.ok(syringes, "insulin syringes are missing");
  assert.ok(swabs, "alcohol swabs are missing");
  assert.equal(syringes.name, "INSULIN SYRINGES");
  assert.equal(swabs.name, "ALCOHOL SWABS");
  assert.equal(syringes.sku, "Syr01");
  assert.equal(swabs.sku, "Alc01");
  assert.ok(syringes.categories.includes("ACCESSORIES"));
  assert.ok(swabs.categories.includes("ACCESSORIES"));
  assert.equal(syringes.image, "/accessories/insulin-syringes.png");
  assert.equal(swabs.image, "/accessories/alcohol-swabs.png");
  const publicDir = fileURLToPath(new URL("../../public", import.meta.url));
  assert.ok(existsSync(`${publicDir}${syringes.image}`), "insulin syringes photo is missing");
  assert.ok(existsSync(`${publicDir}${swabs.image}`), "alcohol swabs photo is missing");
  assert.equal(syringes.variants[0]?.option, "10");
  assert.equal(syringes.variants[0]?.price, 12);
  assert.equal(swabs.variants[0]?.option, "100");
  assert.equal(swabs.variants[0]?.price, 8);
  assert.match(syringes.description, /1 ml/i);
  assert.match(swabs.description, /isopropyl/i);
  for (const [product, queries] of [
    [syringes, ["insulin syringes", "insulin", "syringe", "Syr01"]],
    [swabs, ["alcohol swabs", "alcohol", "swab", "isopropyl", "Alc01"]],
  ] as const) {
    const haystack = [
      product.name,
      product.sku,
      product.slug.replaceAll("-", " "),
      product.description,
      ...product.categories,
    ]
      .join(" ")
      .toLowerCase();
    for (const query of queries) {
      assert.ok(
        query
          .toLowerCase()
          .split(/\s+/)
          .every((term) => haystack.includes(term)),
        `${query} should match ${product.slug}`,
      );
    }
  }
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
