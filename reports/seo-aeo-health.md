# SEO & AEO Health Report

> **Purpose:** This report is owned by the **SEO/AEO specialist agent**. It tracks the Redline Labs
> storefront's discoverability across both traditional search engines (SEO) and
> answer/AI engines (AEO — Answer Engine Optimization): metadata, structured data,
> crawlability, sitemaps, and machine-readable content that helps search and AI assistants
> understand and cite the catalogue.

## Scope / responsibilities

- Page metadata: titles, descriptions, canonical/`metadataBase`, OpenGraph, Twitter cards.
- Structured data (JSON-LD): `Organization`, `WebSite` + `SearchAction`, and per-product
  `Product`/`Offer`/`AggregateOffer`.
- Crawl directives: `robots.ts` rules and `sitemap.ts` coverage.
- Social/preview images (`opengraph-image`, `twitter-image`).
- AEO signals: descriptive product copy, FAQ content, and schema completeness that make the
  catalogue answerable and citable by AI assistants.
- Keyword/intent coverage across catalogue, product, and informational pages.

## Out of scope (see sibling reports)

- Whether the pages render at all → `website-health.md`
- Product data accuracy/pricing → `catalogue-merchandising-health.md`
- Core Web Vitals / performance (an SEO ranking factor, tracked jointly) → `qa-performance-health.md`

## Key files & signals

- `src/app/layout.tsx` — global metadata, `metadataBase`, Organization/WebSite JSON-LD.
- `src/app/product/[slug]/page.tsx` — `generateMetadata` + Product JSON-LD.
- `src/lib/seo.ts` — `SITE_URL`, `absoluteUrl`, `metaDescription` helpers.
- `src/app/sitemap.ts` — static routes + product URLs.
- `src/app/robots.ts` — allow/disallow rules and sitemap/host declaration.
- `src/components/JsonLd.tsx` — structured-data injector.
- `src/lib/faqs.tsx` — FAQ content (AEO surface).

## Health checklist

- [ ] Every indexable route has a unique, on-length title and meta description.
- [ ] `metadataBase`/`SITE_URL` resolve to the canonical production origin.
- [ ] `sitemap.xml` includes all public routes and all current product slugs.
- [ ] `robots.txt` disallows `/account`, `/cart`, `/checkout`, `/api/` and links the sitemap.
- [ ] Product JSON-LD validates (price, currency, availability, brand).
- [ ] OpenGraph/Twitter images resolve for home and product pages.
- [ ] FAQ/answer content is present and schema-eligible for AEO.

## Current status

_Baseline pending first audit._ Inspection confirms Next.js Metadata API usage, JSON-LD for
Organization/WebSite/Product, a dynamic sitemap, and robots rules are already implemented.
Record gaps (e.g. missing per-page canonicals, FAQ schema, breadcrumb JSON-LD) here on each run.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
