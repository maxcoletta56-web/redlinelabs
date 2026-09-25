# Website Health Report

> **Purpose:** This report is owned by the **Website Health specialist agent**. It tracks the overall
> operational health of the Redline Labs storefront (`https://redlinelabs.shop`) — that the site
> builds, deploys, renders, and serves its core pages and flows without errors. It is the
> first place to look when "the site is broken" and the umbrella owner for issues that do not
> clearly belong to one of the other specialist reports.

## Scope / responsibilities

- Successful production build (`next build`) and Vercel deployment health.
- Availability and correct rendering of core routes: home (`/`), catalogue (`/shop`),
  product pages (`/product/[slug]`), cart (`/cart`), checkout (`/checkout`), account
  (`/account`), and the policy pages.
- Global layout, navigation (`Header`, `Footer`), providers, and error/not-found handling.
- Console errors, hydration mismatches, broken images, and broken internal links.
- Third-party embeds that affect page health (e.g. the optional AssistLoop chat widget).
- Redirects declared in `next.config.ts` resolving correctly.

## Out of scope (see sibling reports)

- Search/structured-data specifics → `seo-aeo-health.md`
- Catalogue/product data correctness → `catalogue-merchandising-health.md`
- Cart/checkout conversion tuning → `ecommerce-cro-health.md`
- Automated tests & performance budgets → `qa-performance-health.md`
- Secrets, headers, compliance → `security-compliance-health.md`

## Key files & signals

- `next.config.ts` — image `remotePatterns`, redirects.
- `src/app/layout.tsx` — root layout, global chrome, metadata base.
- `src/app/not-found.tsx`, `src/components/RouteFallback.tsx` — error surfaces.
- `src/components/Header.tsx`, `src/components/Footer.tsx` — global navigation.
- Vercel deployment logs and Preview URLs per branch/PR.

## Health checklist

- [ ] `npm run build` completes with all routes generated.
- [ ] Home, catalogue, and a sample product page return HTTP 200.
- [ ] No console/hydration errors on core pages.
- [ ] Header/footer links resolve (no 404s).
- [ ] Declared redirects (`/product/bac-water`, `/product/product-bacterial-water`) 308 to the canonical slug.
- [ ] Remote product images load from the allow-listed host.

## Current status

_Baseline pending first audit._ Repository inspected on setup; `next build` currently
succeeds and all core routes render locally. Populate this section with dated findings on
each audit run.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
