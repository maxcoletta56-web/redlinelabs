# Redlinelabs Website Health

Last Updated: 26 September 2026

Overall Status: The production branch `cursor/redlinelabs-shop-1c01` at `266be05` is the storefront. GitHub Actions (lint, typecheck, and build) succeeded on that commit, and the Vercel commit status says the deployment completed at 08:55 UTC. Checkout in this tree ignores browser store credit. This environment cannot open `https://redlinelabs.shop`, so the custom domain was not re-checked. The last direct look, on 25 September, still showed a multi-day cache. No production promotion or cache purge was performed.

This file is the umbrella health report. Search, catalogue data, checkout conversion, test budgets, and secrets stay in the sibling reports under `reports/`.

## Critical Issues

None confirmed in this pass. The site was not observed down. A failed custom-domain check would move to this section; that check could not be run from here.

## High Priority Issues

- **Custom domain may still be serving an older build.** On 25 September the homepage cache age was several days, the footer did not show RedlineLabs Limited, `/product/bacterial-water` was a cached 404, and that URL was missing from the live sitemap. Git already contains the legal-entity footer, the Bacterial Water listing, the store-credit checkout fix (`cebe42b`), and the later routing work (`67f9170`, `17f58ab`, `266be05`). Vercel reports a completed deployment of `266be05`. Freshness of `https://redlinelabs.shop` is unconfirmed until someone who can reach the domain checks the footer, `/product/bacterial-water`, and `/sitemap.xml`. Do not purge or redeploy from this automation.
- **`GET /api/checkout/session` still returns email and shipping to anyone who has the Checkout Session id.** Owned by `security-compliance-health.md`. Not changed here.
- **Sibling reports are still scaffolds.** `seo-aeo-health.md`, `catalogue-merchandising-health.md` (findings exist), `ecommerce-cro-health.md`, `qa-performance-health.md`, and `security-compliance-health.md` were not rewritten in this pass. Earlier handoffs (store credit, age confirmation, JSON-LD `InStock` on every listing, remote catalogue images, local-only accounts) still need those owners.

## Medium Priority Issues

- **Next.js is pinned to 16.3.4.** `SITE_HEALTH.md` notes the 22 September 2026 `ImageResponse` advisory and that this app does not import `next/og` or `ImageResponse`. The patch line to track is 16.3.6. Leave the bump to the security owner, and only when the npm registry is reachable.
- **Content-Security-Policy is report-only** in `next.config.ts`. Enforcing it is a security change after the report-only console is clean.
- **Catalogue photos still load from `i0.wp.com`.** A 25 September check recorded 14 of 30 image URLs returning 403. Owned by the catalogue report. `images.remotePatterns` still allows that host.
- **Accounts, orders, addresses, and stock alerts are browser-local.** There is no Stripe webhook. Owned by security and CRO.
- **This agent environment cannot build the storefront.** `next build` stops because `fonts.googleapis.com` is outside the allowlist while `src/app/layout.tsx` loads Inter through `next/font/google`. GitHub Actions can reach Google Fonts and the build there succeeded for `266be05`.

## Low Priority Issues

- **Dead code:** root `index.mts` (only consumer of the `ai` dependency), `src/components/Placeholder.tsx` (no imports), default `public/*.svg` files, and unused `public/brand/hero.png` and `public/brand/logo.png`.
- **`npm test` warns** that `package.json` has no `"type": "module"`. All 39 tests still pass.
- **Draft pull requests `#41`, `#42`, and `#44`** describe earlier production-cache notes. Do not rebase or merge them. Draft `#22` (Vercel Speed Insights) stays untouched; the storefront now loads telemetry from `src/components/VercelTelemetry.tsx` without those packages.
- **The trigger branch `copilot/maxcoletta56-web-redlinelabs-audit` is still `9e018d8` (“Initial plan”, 9 September), 50 commits behind production.** The push that started this run had no commits and placeholder SHAs. It is not the storefront.

## Changes Made

- `src/app/global-error.tsx`: the Home control is a `next/link` `Link`, matching `src/app/error.tsx`. The previous `window.location.assign("/")` produced `@next/next/no-location-assign-relative-destination`. It was a warning, so CI still passed. Lint on this file is now clean. Black and gold styling is unchanged.
- This report, so the 25 September note that the checkout fix was “not on the production branch” is retired. That fix is in `266be05`.

No catalogue copy, prices, checkout totals, or design-system changes.

## Tests Performed

- `npm test`: 39 passed, 0 failed. Includes “checkout ignores client-supplied store credit” and “bacterial water is listed as an accessory”.
- `npx eslint src/app/global-error.tsx src/app/error.tsx`: passed with no warnings.
- `npx tsc --noEmit`: passed.
- `npm run check`: lint and typecheck passed. `next build` failed locally while fetching Inter from Google Fonts (egress). Not treated as a repository defect.
- GitHub Actions run `36231222108` on `266be05`: lint, typecheck, and build succeeded.
- `https://redlinelabs.shop` was not requested successfully. Curl returned an SSL error, and the URL is not on this environment’s allowlist.
- No card payment was submitted. Header, footer, shop, and product pages were not opened in a browser.

## Build Status

Production-branch CI at `266be05` is green, including `next build` (Next.js 16.3.4). Vercel’s GitHub status for that commit is success (“Deployment has completed”). This working tree’s local production build did not finish, because Google Fonts is blocked here. This branch has not been deployed by this run.

## Outstanding Work

- Recheck `https://redlinelabs.shop` from a network that can reach it: footer must include RedlineLabs Limited, `/product/bacterial-water` must be 200, `/sitemap.xml` must list that slug, and `/product/bac-water` must redirect to it. If the cache is still the pre-`cebe42b` build, a person with Vercel access decides whether to purge. This automation must not.
- Specialist agents update their own reports. Do not open a second store-credit checkout change. `serverStoreCreditCents()` stays 0 until credit comes from server records.
- Leave draft PRs `#41`, `#42`, `#44`, and `#22` unmerged.
- Keep the Redline Labs black and gold storefront. `cursor/metro-uniforms-about-151c` is not the current brand.

## Recommendations

- Treat `cursor/redlinelabs-shop-1c01` as the production line. Ignore `copilot/maxcoletta56-web-redlinelabs-audit` until it is rebuilt from that line.
- After the custom domain shows `266be05`, close the cache item. Until then, do not describe catalogue or checkout fixes as live.
- Use the preview for this branch. Do not promote it.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Recorded render and deploy findings. Handed checkout, security, SEO, catalogue, and test items to sibling reports. |
| 2026-09-26 | website health | Corrected the report against `266be05`. CI and the Vercel status are green. The custom domain was not re-probed. Home on the global error page now uses `Link`. |
