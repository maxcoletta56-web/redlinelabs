# Redlinelabs Website Health

Last Updated: 2026-09-25 13:10 UTC

Overall Status: At risk. Core routes on https://redlinelabs.shop respond, but the public domain is still serving a build from before the Hong Kong legal-entity update and before Bacterial Water’s canonical URL. Later GitHub Production deployments report success and are not what the domain serves.

This file is the umbrella report. Specialist detail stays in the sibling files under `reports/`. Do not copy those audits into a second full write-up.

Scope: build and deploy health, core routes, navigation, redirects, and broken images that take the storefront down or show the wrong deployment. Catalogue data fixes belong in `catalogue-merchandising-health.md`. SEO, checkout conversion, test budgets, and secrets stay in their own reports.

## Critical Issues

- **Public production is not the current production branch.** https://redlinelabs.shop still renders the pre-#32 footer (`© 2026 Redline Labs. For laboratory research use only.`). Current `Footer.tsx` (since `d19356c`, Production deployment recorded 2026-09-22T04:45:50Z) renders `RedlineLabs Limited` and the Hong Kong company number. The live About page contains neither “Hong Kong” nor `80442501`.
- **Bacterial Water is not on the public site.** `GET /product/bacterial-water` is HTTP 404, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, original `date: Wed, 23 Sep 2026 02:12:23 GMT` (about 59 hours old at check time). It is absent from the live sitemap. `GET /product/product-bacterial-water` is HTTP 308 to `/shop`. Current `next.config.ts` redirects that path to `/product/bacterial-water`. The `/shop` redirect was removed in `c5c16f1` (Production deployment recorded 2026-09-21T04:43:11Z).
- GitHub records later Production deployments as **success**, including `55a0dc1` (2026-09-23T23:33:59Z), `a127208` (2026-09-25T12:46:00Z), and `0ad846f` (2026-09-25T13:00:52Z, Vercel context “Deployment has completed”). Those `*.metrouniforms.vercel.app` deployment URLs redirect to Vercel SSO, so this run could not confirm their HTML. The custom domain was not updated to match them. Do not promote or redeploy production from this agent.

## High Priority Issues

- **Featured Tesamorelin photo is blocked.** Catalogue audit (`reports/catalogue-merchandising-health.md`): 14 of 30 image URLs on `i0.wp.com` return HTTP 403 (`We cannot complete this request, remote data could not be fetched`). `ProductImage` then shows `/brand/vial.png`. Spot-check this run: Tesamorelin image 403; `bpc-157` and `ghk-cu` returned `image/png` 200. Owner: Catalogue & Merchandising. Do not re-fetch the whole set here.
- **Eleven listings have a price and no variant**, so the shop and product page cannot show a dose (`ghk-cu`, `products-slu-pp-322`, `product-tb-1`, `bpc-tb-blend`, `products-kisspepien`, `tb4`, `ghk-1200`, `cjc-1295`, `products-ss-31`, `products-kpv`, `products-pt-141`). Owner: Catalogue & Merchandising.
- **Product page SKU is the parent SKU**, which often is not the selected option (CJC/Ipamorelin, NAD+, MOTS-C, Semax, HCG, TB-500, and default-option mismatches on Retatrutide, DSIP, Epitalon). Owner: Catalogue & Merchandising, with a small product-page change if they take it.
- **`products-slu-pp-322` is titled SLU-PP-322 while the description says SLU-PP-332.** Owner: Catalogue & Merchandising.

## Medium Priority Issues

- `premiumProducts()` (`bpc-157`, `products-nad`, `tb-500`, `products-glow`) has no caller, so premium picks never render.
- Related products are empty for the three singleton categories (Retatrutide, Melanotan 2, Bacterial Water). Tissue Research rows are filled from early file order.
- Cards show `minPrice` only. `priceLabel` is unused, so Retatrutide does not show `$100.00 – $245.00`.
- Search matches the parent SKU, not variant SKUs or option text.
- Sixteen slugs still use a `products-` or `product-` prefix. `products-kisspepien` does not match “Kisspeptin”. Redirects exist only for the old bacterial-water paths.
- No analytics package is integrated (GA4, Vercel Analytics, Plausible, or PostHog). Privacy copy still talks about cookies and analytics in general.
- SEO, CRO, QA, and security reports are still scaffolds. Their first audits have not been recorded, so this umbrella does not invent findings for them.
- `/shop` is a client component, so the catalogue grid is not in the first HTML document. Leave the SEO impact to `seo-aeo-health.md`.

## Low Priority Issues

- Loaded catalogue photos are not square (examples 800×533 through 450×800) inside `aspect-square` frames, so they letterbox.
- Epitalon, Kisspeptin, and Semax are title case while most names are uppercase, including the home ticker.
- Default Next.js SVGs remain in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) and are unused by the storefront.

## Changes Made

- Confirmed the 2026-09-25 push (`0ad846f`, catalogue audit #39) and read `reports/project-overview.md` plus the six specialist scaffolds before editing.
- Moved the catalogue audit into the canonical file `reports/catalogue-merchandising-health.md` (checklist updated from that audit). The repo-root `catalogue-merchandising-health.md` is now a pointer so the two copies cannot drift.
- No storefront, brand, product-data, or Vercel config changes. Metro Uniforms / Redline visual system was left as it is.

## Tests Performed

- Live route checks (no redirect follow) on 2026-09-25: `/`, `/shop`, `/cart`, `/checkout`, `/account`, `/about`, `/faq`, `/contact`, `/privacy-policy`, `/refund-policy`, `/shipping-policy`, `/terms-of-service`, `/product/retatrutide`, `/product/tesamorelin`, `/sitemap.xml`, `/robots.txt` all HTTP 200. `/product/bacterial-water` HTTP 404. `/product/bac-water` HTTP 404. `/product/product-bacterial-water` HTTP 308 to `/shop`.
- Live sitemap: 38 URLs, no bacterial-water entry. Live About/home HTML: no “Hong Kong”, no `RedlineLabs Limited`.
- Image spot-check: Tesamorelin URL HTTP 403; BPC-157 and GHK-Cu HTTP 200 PNG.
- `POST /api/checkout` with `{}` returns HTTP 400 `{"error":"A valid email is required"}` (route is up; validation responds). No checkout was completed and no keys were read.
- Browser console, hydration, and mobile layout were not exercised this run (documentation and live HTTP only).
- `npm run lint`, `npm test`, and `npm run build` were not re-run: this change is report-only and `node_modules` is not installed in this environment.

## Build Status

- Not rebuilt locally this session.
- QA scaffold (setup, before this audit) recorded lint clean, 31/31 unit tests, and `next build` generating 52 routes. Treat that as the last local baseline, not as a result from this run.
- Vercel GitHub status on `0ad846f`: success, “Deployment has completed”. That status does not match what https://redlinelabs.shop is serving (see Critical Issues).

## Outstanding Work

- Find why Production deployments after 2026-09-21 are not assigned to https://redlinelabs.shop (Vercel project `metrouniforms/redlinelabs`, production branch `cursor/redlinelabs-shop-1c01`). Needs a human with Vercel access. This agent must not promote a deployment.
- Catalogue & Merchandising: replace or re-host the 14 blocked images, add real variants (or an explicit single-option) on the 11 empty listings, show the selected SKU, and resolve the SLU-PP-322 / SLU-PP-332 name clash.
- SEO + AEO, E-commerce + CRO, QA + Performance, and Security + Compliance: first audits are still outstanding. Read `reports/project-overview.md` and only update your own file.
- After the domain serves current `HEAD`, re-check `/product/bacterial-water` (expect 200) and both bacterial-water redirects (expect 308 to that URL).

## Recommendations

- Keep one report per specialist under `reports/`. The umbrella file should point at specialist findings, not restate them in full.
- Leave product JSON and merchandising components to the catalogue agent unless a change is required to fix a broken route.
- Confirm the Vercel production domain, production branch, and deployment protection before the next catalogue or legal-copy change is treated as live.
- Add a post-deploy check that the live footer contains `RedlineLabs Limited` and that `/product/bacterial-water` is 200, so a stuck domain is caught without another full audit.
