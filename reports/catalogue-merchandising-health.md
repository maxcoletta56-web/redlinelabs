# Catalogue & Merchandising Health Report

> **Purpose:** This report is owned by the **Catalogue & Merchandising specialist agent**. It tracks the
> correctness, completeness, and presentation of the product catalogue — the data in
> `src/data/products.json` and how it is surfaced across the catalogue, product, featured,
> and related-product experiences.

## Scope / responsibilities

- Product data integrity: unique `id`/`slug`/`sku`, valid `categories`, `variants`,
  `minPrice`/`maxPrice`, and image references.
- Category taxonomy consistency (`categories` in `src/lib/products.ts`).
- Merchandising surfaces: featured products, premium picks, related products, search/sort/filter.
- Variant/dose labelling (MG/IU) correctness.
- Image availability and aspect/quality for each product.
- Pricing display and currency formatting (AUD).

## Out of scope (see sibling reports)

- Structured data/SEO for products → `seo-aeo-health.md`
- Add-to-cart / checkout conversion → `ecommerce-cro-health.md`
- Page-render failures → `website-health.md`

## Key files & signals

- `src/data/products.json` — the single source of product truth (currently ~30 products).
- `src/lib/products.ts` — types, categories, featured/premium slugs, query/related helpers.
- `src/lib/variant-label.ts` — dose/option label formatting.
- `src/app/shop/page.tsx` — catalogue grid, search, category filter, sort.
- `src/app/product/[slug]/page.tsx` — product detail + related products.
- `src/components/ProductCard.tsx`, `src/components/ProductImage.tsx` — presentation.

## Health checklist

- [ ] All `featuredSlugs`/`premiumSlugs` resolve to existing products.
- [ ] Every product has ≥1 variant and consistent `minPrice`/`maxPrice`.
- [ ] No duplicate `slug` or `sku` values.
- [ ] Every product `image` loads from the allow-listed remote host.
- [ ] Each product's `categories` are members of the canonical `categories` list.
- [ ] Search matches by name, sku, slug, description, and category.
- [ ] Related products return same-category items only.

## Current status

_Baseline pending first audit._ Catalogue holds ~30 products across categories including
GLP-1, tissue, growth, brain-performance, energy, reproductive, blends, melanocortin, and
accessories. Record data anomalies and merchandising gaps here on each run.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
