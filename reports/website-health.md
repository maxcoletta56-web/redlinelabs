# Website Health Report

> **Purpose:** This report is owned by the **Website Health specialist agent**. It tracks the overall
> operational health of the Redline Labs storefront (`https://redlinelabs.shop`) — that the site
> builds, deploys, renders, and serves its core pages and flows without errors. It is the
> first place to look when "the site is broken" and the umbrella owner for issues that do not
> clearly belong to one of the other specialist reports.

Last Updated: 25 September 2026

Overall Status: The live site at https://redlinelabs.shop/ is up, Stripe live checkout is configured, and the main catalogue pages return 200. Checkout on this branch no longer treats a browser store-credit balance as a Stripe coupon. That fix is not on production until it is reviewed and deployed. The current design system is Redline Labs black and gold.

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

- [x] `npm run build` completes with all routes generated. Local build on 25 September 2026 succeeded, including `/product/bacterial-water`. CI on the base branch now runs lint, typecheck, and build.
- [x] Home, catalogue, and a sample product page return HTTP 200. Production probe the same day: home, shop, about, FAQ, contact, cart, checkout, account, four policy pages, and `/product/bpc-157` returned 200.
- [x] No console/hydration errors on core pages. Local browser pass reported no console issues.
- [x] Header/footer links resolve (no 404s). Those routes returned 200. Mobile menu showed Home, Shop, About, FAQ, and Contact.
- [ ] Declared redirects (`/product/bac-water`, `/product/product-bacterial-water`) 308 to the canonical slug. Not re-checked in this pass.
- [ ] Remote product images load from the allow-listed host. One sampled BPC-157 image returned 200. Image failures for other listings belong in `catalogue-merchandising-health.md`.

## Current status

Production is serving the site. It is behind the repository: `GET /product/bacterial-water` returned 404 on 25 September 2026 and that URL was absent from the live sitemap, while the listing is already in `src/data/products.json`. The homepage cache `age` was about 4.5 days. Publishing that listing is a deploy of existing catalogue commits, not part of the checkout change.

AssistLoop is enabled in production. The homepage HTML preloads `https://assistloop.ai/assistloop-widget.js`.

`npx tsc --noEmit` used to fail with `Cannot find name 'LayoutProps'` until `next build` generated route types. The base branch now types the root layout `children` as `ReactNode`, so that failure is closed on this merge.

Contact is a `mailto:` composer. The newsletter form says it does not start a mailing list. Both render and do what they say.

### Handed to sibling reports

These came out of the same pass. They stay listed here so the audit is not dropped, and the owning report should record them.

- `ecommerce-cro-health.md`: checkout used to create a Stripe coupon from a browser store-credit amount. Account balances live only in `localStorage`. This branch ignores that amount and no longer subtracts it from “Due now”. The CRO checklist still says store credit should apply at checkout; that item disagrees with this code.
- `ecommerce-cro-health.md`: the live checkout path did not require age and research-use confirmation on the server. The server action and `POST /api/checkout` now reject a session unless both are true. Account, FAQ, checkout, and the restock control no longer promise email alerts or an automatic credit deduction.
- `security-compliance-health.md`: accounts, orders, addresses, and stock alerts are browser-local. There is no Stripe webhook. `GET /api/checkout/session` returns email and shipping to anyone with the Checkout Session id. Live homepage headers were HSTS only, plus `Access-Control-Allow-Origin: *`.
- `seo-aeo-health.md`: product JSON-LD marks every listing `InStock`. FAQ content has no `FAQPage` schema. Slugs include `products-dsip`, `product-tb-1`, and the misspelling `products-kisspepien`.
- `catalogue-merchandising-health.md`: listing titles mix case. Catalogue photos are remote `i0.wp.com` files with a `/brand/vial.png` fallback.
- `qa-performance-health.md`: no product analytics in the repo. Draft pull request `#22` is Vercel Speed Insights. The test runner warns that `package.json` has no `"type": "module"`. Dead code: root `index.mts` (only consumer of the `ai` dependency), `src/components/Placeholder.tsx`, default `public/*.svg` files, and unused `public/brand/hero.png` and `public/brand/logo.png`.

### Changes on this branch

- Checkout no longer turns a browser store-credit balance into a Stripe coupon.
- Checkout requires age and research-use confirmation before creating a session.
- Checkout, account, FAQ, and the product restock control match that behaviour.
- No visual redesign. Header, gold/black palette, catalogue data, and the DGC20 coupon behaviour are unchanged.

### Tests performed

- `npm test`: 32 passed, 0 failed.
- `npm run lint`: passed.
- `npm run build` (Next.js 16.3.4): passed. Static product paths include `/product/bacterial-water`.
- `npx tsc --noEmit` after that build: passed. Re-run after this merge because the base branch added `npm run typecheck` and changed `src/app/layout.tsx`.
- Local browser pass against `next start`: FAQ account answer, account benefit cards, BPC-157 restock line, shop search `bpc`, checkout summary with store credit $0.00, and the mobile menu at 390px. No card payment was submitted.

### Build status

Local production build succeeded on 25 September 2026 before this merge. This branch has not been deployed. Production was not updated.

### Outstanding work

- Review and, only when explicitly requested, deploy the checkout fix. Production still applies client-supplied store credit until then.
- Decide whether Bacterial Water should be published by deploying the existing catalogue commits.
- Keep the Redline Labs black and gold storefront. A historical branch named `cursor/metro-uniforms-about-151c` is not the current brand.
- Use a Vercel preview for this branch. Do not promote it to production without an explicit request.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into this scaffold. Render and deploy findings stay here. Checkout, security, SEO, catalogue, and test findings are handed to the sibling reports. |
