# Redlinelabs Website Health

Last Updated: 2026-09-25 13:10 UTC

Overall Status: At risk. Core routes on https://redlinelabs.shop respond, and GitHub records the latest production deploy as successful, but the public domain is still serving a storefront from before the Hong Kong legal-entity update and before Bacterial Water’s canonical URL. Checkout can still turn a browser-supplied store-credit amount into a Stripe coupon. That fix is already open in pull request #37 and is not repeated here.

This file is the umbrella report. Specialist detail stays in the sibling files under `reports/`. Catalogue findings are recorded in `reports/catalogue-merchandising-health.md` (filed by #40). Do not copy those audits into a second full write-up.

Scope: build and deploy health, core routes, navigation, redirects, and failures that take the storefront down or show the wrong deployment. Catalogue data, SEO, checkout conversion copy, test budgets, and secrets stay in their own reports. Payment integrity is listed here because it can charge the wrong amount, and the open fix is named so it is not rebuilt.

## Critical Issues

- **Public production is not the current production branch.** At 2026-09-25T13:07:54Z the homepage was `x-vercel-cache: HIT` with `age: 394929` (about 4.6 days), so the cached document dates from about 2026-09-20T23:25Z. The rendered footer is `© 2026 Redline Labs. For laboratory research use only.` Current `Footer.tsx` (since `d19356c`) renders `RedlineLabs Limited` and Hong Kong company number `80442501`. The live home and About HTML contain neither “Hong Kong” nor `RedlineLabs Limited`.
- **Bacterial Water is not on the public site.** `GET /product/bacterial-water` is HTTP 404, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `date: Wed, 23 Sep 2026 02:12:23 GMT`. It is absent from the live sitemap (38 URLs, 29 `/product/` URLs). `GET /product/bac-water` is the same cached 404. `GET /product/product-bacterial-water` is HTTP 308 to `/shop`. Current `next.config.ts` redirects both legacy paths to `/product/bacterial-water`. The `/shop` redirect was removed in `c5c16f1`.
- **GitHub Production deployments after 2026-09-21 report success and are not what the domain serves.** The push that triggered this run, `311e32f` (#40), has deployment `6661374135` (environment Production, state success, “Deployment has completed”, 2026-09-25T13:05:55Z). The Vercel commit status is success. The `*.metrouniforms.vercel.app` deployment host is SSO-gated, so its HTML was not fetched. The custom domain cache age still increased across this check, which means the new deployment did not replace https://redlinelabs.shop. Do not promote or redeploy production from this agent.
- **Checkout applies browser store credit as a Stripe coupon.** `startCartCheckoutSession` forwards `storeCreditCents` into `createEmbeddedCheckoutSession`, which creates a coupon via `stripeCouponParams`. Account balances live in `localStorage`. There is no server ledger behind that amount, so a client-supplied value can reduce the card charge. The age and research-use checks exist on `POST /api/checkout` and are not applied in the server action the checkout form uses. Open pull request #37 (`cursor/checkout-integrity-bf7c`) already stops the client credit and requires both confirmations on the server. Leave that diff to review. Do not open a second fix.

## High Priority Issues

- **Featured Tesamorelin photo is blocked.** Catalogue audit (`reports/catalogue-merchandising-health.md`): 14 of 30 image URLs on `i0.wp.com` return HTTP 403. `ProductImage` then shows `/brand/vial.png`. Spot-check this run: Tesamorelin image 403; `bpc-157` and `ghk-cu` returned `image/png` 200. Owner: Catalogue & Merchandising. Do not re-fetch the whole set here.
- **Eleven listings have a price and no variant, the product page prints the parent SKU, and `products-slu-pp-322` is titled SLU-PP-322 while the description says SLU-PP-332.** Detail and the slug list are in `reports/catalogue-merchandising-health.md`. Owner: Catalogue & Merchandising.

## Medium Priority Issues

- `premiumProducts()` has no caller, related products are empty for singleton categories, cards show `minPrice` only, and search ignores variant SKUs. Same catalogue report. Owner: Catalogue & Merchandising.
- Sixteen slugs still use a `products-` or `product-` prefix. Redirects exist only for the old bacterial-water paths. SEO impact belongs in `reports/seo-aeo-health.md`.
- No analytics package is integrated (GA4, Vercel Analytics, Plausible, or PostHog). Draft pull request #22 adds Vercel Speed Insights. Privacy copy still talks about cookies and analytics in general.
- SEO, CRO, QA, and security reports are still scaffolds. Their first audits have not been recorded, so this umbrella does not invent findings for them.
- Live homepage response headers include `strict-transport-security` and `access-control-allow-origin: *`. No `content-security-policy`, `x-frame-options`, or `referrer-policy` was present on that response. Header policy belongs in `reports/security-compliance-health.md`. A strict CSP needs a Stripe Embedded Checkout allowlist before anyone adds one.
- `/shop` is a client component, so the catalogue grid is not in the first HTML document. Leave the SEO impact to `reports/seo-aeo-health.md`.

## Low Priority Issues

- Loaded catalogue photos are not square inside `aspect-square` frames, so they letterbox. Detail is in the catalogue report.
- Epitalon, Kisspeptin, and Semax are title case while most names are uppercase.
- Default Next.js SVGs remain in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) and are unused by the storefront.
- Root `index.mts` calls the `ai` package and no App Router route imports it (`reports/project-overview.md`).

## Changes Made

- Re-checked https://redlinelabs.shop after production deployment `6661374135` for `311e32f` (#40) and replaced the website-health scaffold with this audit.
- Read `reports/project-overview.md` and the catalogue audit now at `reports/catalogue-merchandising-health.md`. Did not edit that audit, product JSON, checkout code, or the visual system.
- Confirmed on current `HEAD` that `startCartCheckoutSession` still forwards client `storeCreditCents` into Stripe coupon creation. The code change stays in pull request #37.

## Tests Performed

- Live route checks (no redirect follow) on 2026-09-25: `/`, `/shop`, `/cart`, `/checkout`, `/account`, `/about`, `/faq`, `/contact`, `/privacy-policy`, `/refund-policy`, `/shipping-policy`, `/terms-of-service`, `/product/retatrutide`, `/product/tesamorelin`, `/sitemap.xml`, `/robots.txt` all HTTP 200. `/product/bacterial-water` HTTP 404. `/product/bac-water` HTTP 404. `/product/product-bacterial-water` HTTP 308 to `/shop`.
- Live sitemap: 38 URLs, 29 product URLs, no bacterial-water entry. Live home and About HTML: no “Hong Kong”, no `RedlineLabs Limited`. Footer text quoted above.
- Homepage `age` was 394929 seconds at 2026-09-25T13:07:54Z, after the 13:05:55Z production deployment had already completed.
- Image spot-check: Tesamorelin URL HTTP 403; BPC-157 and GHK-Cu HTTP 200 PNG.
- `POST /api/checkout` with `{}` returns HTTP 400 `{"error":"A valid email is required"}`. No checkout session was created and no keys were read.
- Browser console, hydration, and mobile layout were not exercised this run (live HTTP and source inspection only).
- `npm run lint`, `npm test`, and `npm run build` were not re-run: this change is the report only, and `node_modules` is not installed in this environment. QA scaffold still records the last setup baseline (lint clean, 31/31 unit tests, `next build`). Pull request #37 reports 32/32 after its own checkout tests. Treat both as other runs, not as results from this one.

## Build Status

- Not rebuilt locally this session.
- Vercel GitHub status on `311e32f`: success, “Deployment has completed”, deployment `6661374135`, environment Production. That status does not match what https://redlinelabs.shop is serving (see Critical Issues).

## Outstanding Work

- Find why Production deployments after 2026-09-21 are not assigned to https://redlinelabs.shop (Vercel project `metrouniforms/redlinelabs`, production branch `cursor/redlinelabs-shop-1c01`). Needs a human with Vercel access. This agent must not promote a deployment.
- Review pull request #37 for the store-credit guard. When that branch is rebased onto current `HEAD`, keep this `reports/website-health.md` and drop the copy added on `cursor/checkout-integrity-bf7c` (that branch was cut before `reports/` existed and will conflict).
- Draft pull request #41 also rewrote this file and moved the catalogue audit. #40 already filed the catalogue audit. Do not merge #41 on top of this report.
- Catalogue & Merchandising: replace or re-host the 14 blocked images, add real variants (or an explicit single option) on the 11 empty listings, show the selected SKU, and resolve the SLU-PP-322 / SLU-PP-332 name clash. Work only in `reports/catalogue-merchandising-health.md` plus the catalogue files.
- SEO + AEO, E-commerce + CRO, QA + Performance, and Security + Compliance: first audits are still outstanding. Read `reports/project-overview.md` and only update your own file.
- After the domain serves current `HEAD`, re-check `/product/bacterial-water` (expect 200) and both bacterial-water redirects (expect 308 to that URL). Re-check the footer for `RedlineLabs Limited`.

## Recommendations

- Keep one report per specialist under `reports/`. The umbrella file should point at specialist findings and name the pull request that already owns a fix.
- Ship the checkout credit guard in #37 before further storefront feature work. It is a payment-integrity fix. Production was not deployed from that branch, and it should not be promoted until preview review says so.
- Leave product JSON and merchandising components to the catalogue agent unless a change is required to fix a broken route.
- Confirm the Vercel production domain, production branch, and deployment protection before the next catalogue or legal-copy change is treated as live.
- Add a post-deploy check that the live footer contains `RedlineLabs Limited` and that `/product/bacterial-water` is 200, so a stuck domain is caught without another full audit.
- Keep the current Redline Labs storefront. This run did not change layout, colour, or brand components.
