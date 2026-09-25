# Redlinelabs Website Health

Last Updated: 25 September 2026, 16:58 UTC

Overall Status: Degraded. The production branch `cursor/redlinelabs-shop-1c01` is at `cebe42b` (#37), which stops checkout from turning a browser store-credit balance into a Stripe coupon. https://redlinelabs.shop is up, and the main catalogue routes return 200, but the custom domain is still serving older cached HTML. Customers are not yet on the checkout fix, the Hong Kong entity footer, or the Bacterial Water listing. The current design system is Redline Labs black and gold.

## Critical Issues

- **The public domain is not serving the current production commit.** Minutes after `cebe42b` landed, the homepage was `x-vercel-cache: HIT` with `age: 408744` (about 4.7 days). The footer on that HTML is `© 2026 Redline Labs`. The repository footer is `© 2026 RedlineLabs Limited (Hong Kong Co. No. 80442501). Trading as Redline Labs.` The homepage hero still says `29 listings`. This is the same drift seen after the #40 deploy: later production commits, including #43 and #37, have not replaced the custom-domain cache. Do not promote, purge, or redeploy from an agent run. A person with Vercel access needs to confirm which deployment is bound to `redlinelabs.shop`.

- **Live checkout can still describe store credit as a discount.** The homepage FAQ in the cached HTML says store credit applies automatically at checkout. In git, that answer says the balance shown on the account page is not deducted from the card charge, and `serverStoreCreditCents()` returns `0`. Until the domain serves `cebe42b`, a browser-only balance can still reduce what Stripe charges. Do not open a second checkout fix. #37 is merged.

- **Bacterial Water is a cached 404 on the live site.** `GET /product/bacterial-water` and `GET /product/bac-water` returned 404, both `x-vercel-cache: HIT`, cached response `date: Wed, 23 Sep 2026 02:12:23 GMT`, `age: 225946`. The live sitemap has no bacterial-water URL. `GET /product/product-bacterial-water` returned 308 to `/shop`. Git `next.config.ts` redirects both `/product/bac-water` and `/product/product-bacterial-water` to `/product/bacterial-water`.

## High Priority Issues

These stay with the specialist reports. Do not re-implement them in a website-health change.

- **Catalogue** (`reports/catalogue-merchandising-health.md`): 14 catalogue image URLs returned HTTP 403 from `i0.wp.com` on 25 September 2026; 11 listings have an empty `variants` array; premium picks are unused; the product page prints the parent SKU. The live homepage is the older 29-listing snapshot, so those git findings are not what customers see yet.
- **Checkout copy vs code** (`reports/ecommerce-cro-health.md`): git ignores client store credit and requires age and research-use confirmation before creating a session. The CRO checklist item that says store credit should apply at checkout disagrees with that code. Leave credit at zero until it is loaded from server records.
- **Account and session exposure** (`reports/security-compliance-health.md`): accounts, orders, addresses, and stock alerts are browser-local. There is no Stripe webhook. `GET /api/checkout/session` returns email and shipping to anyone with the Checkout Session id. Live homepage headers were HSTS plus `Access-Control-Allow-Origin: *`.
- **Search markup** (`reports/seo-aeo-health.md`): product JSON-LD marks listings `InStock`; FAQ content has no `FAQPage` schema; several slugs still use a `products-` or `product-` prefix, including `products-kisspepien`. The live sitemap is missing Bacterial Water because of the stale deploy, not because `sitemap.ts` omits it.
- **Stale draft reports.** Pull requests #41 and #42 still describe the pre-merge state (checkout fix open, catalogue file move). #40 already filed the catalogue audit, and #37 is merged. Rebasing those drafts will conflict on `reports/website-health.md`. Do not revive them.

## Medium Priority Issues

- No product analytics in the repository. Draft pull request #22 is Vercel Speed Insights. Leave it draft unless someone asks to add analytics.
- Root `index.mts` is the only consumer of the `ai` dependency and is not an App Router route. `src/components/Placeholder.tsx` has no other references. `public/vercel.svg`, `public/brand/hero.png`, and `public/brand/logo.png` are still in the tree. Confirm before deleting; this run did not remove them.
- `reports/ecommerce-cro-health.md`, `reports/seo-aeo-health.md`, `reports/qa-performance-health.md`, and `reports/security-compliance-health.md` still say the baseline audit is pending. The handoff above is the source for those passes. `reports/catalogue-merchandising-health.md` is the catalogue audit.
- The earlier checkout pass reported a Node test-runner warning that `package.json` has no `"type": "module"`. Not re-run here.

## Low Priority Issues

- Listing titles mix case, and 16 slugs still carry an old `products-` or `product-` prefix. Owned by the catalogue report.
- A historical branch named `cursor/metro-uniforms-about-151c` is not the current brand. Keep the Redline Labs black and gold storefront.

## Changes Made

- Rewrote this report against `cebe42b` and a live probe at 16:58 UTC. No storefront, catalogue, environment, or Vercel config changes. Production was not deployed or cache-purged.
- Noted on the e-commerce and security reports that the checkout credit fix is merged in git and must not be reopened, and that the live domain is still the older cache.
- Added a project-overview changelog row for the same probe.

## Tests Performed

- Live HTTP checks at 25 September 2026, 16:58 UTC: `/`, `/shop`, `/about`, `/faq`, `/contact`, `/cart`, `/checkout`, `/account`, four policy pages, and `/product/bpc-157` and `/product/ghk-cu` returned 200. `/product/bacterial-water` and `/product/bac-water` returned 404. `/product/product-bacterial-water` returned 308 to `/shop`.
- Homepage HTML: footer `© 2026 Redline Labs`, hero `29 listings`, AssistLoop script preload, FAQ line that store credit applies automatically at checkout.
- Compared that HTML with `src/lib/faqs.tsx`, `src/lib/store-credit.ts`, `src/lib/company.ts`, and `next.config.ts` at `cebe42b`.
- No local `npm test`, lint, or `next build`. This run did not change application code, and `node_modules` is not installed in the workspace. CI from #43 (lint, typecheck, build) is already on the production branch.

## Build Status

Local build was not run. The live custom domain is serving a successful older Vercel cache, not an error page. Whether the `cebe42b` deployment itself finished was not available from the Vercel API in this run. Homepage cache age of about 4.7 days means production deploys after ~20 September 2026 have not replaced that document.

## Outstanding Work

- A person with Vercel access should confirm the deployment assigned to https://redlinelabs.shop and replace the stale cache only when that promotion is explicitly requested.
- After the domain serves `cebe42b`, re-check: footer names RedlineLabs Limited, `/product/bacterial-water` returns 200, both legacy bacterial-water paths 308 to that slug, the sitemap lists it, and the FAQ no longer says store credit is deducted at checkout.
- Specialist passes should update their own reports from the high-priority list. Do not open another store-credit checkout change.
- Draft pull requests #41 and #42 can be closed as superseded.

## Recommendations

- Judge customer impact from the live domain and intended behaviour from git. They disagree until the cache is replaced.
- Keep checkout store credit at `serverStoreCreditCents()` until credit comes from server records.
- Keep the Redline Labs black and gold design system.
- Use a Vercel Preview for future code changes. Do not promote this report to production by itself; it does not change the storefront.

## Scope

This file is the umbrella health report. Render, deploy, and navigation failures stay here. Search markup belongs in `reports/seo-aeo-health.md`. Catalogue data belongs in `reports/catalogue-merchandising-health.md`. Cart and Stripe conversion belongs in `reports/ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals belong in `reports/qa-performance-health.md`. Secrets, headers, and compliance belong in `reports/security-compliance-health.md`.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into the scaffold as part of #37. |
| 2026-09-25 | website health | Recorded that `cebe42b` is on the production branch and https://redlinelabs.shop is still the older cache. |
