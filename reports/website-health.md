# Redlinelabs Website Health

Last Updated: 30 September 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `545b58c` (pull request #88, continue shopping). GitHub CI passed and the Vercel production deployment completed. This environment cannot open a TLS connection to `https://redlinelabs.shop`, so the new cart control was reviewed in source and was not clicked on the live site. That TLS failure is not an outage. No new critical break was found in the push. The storefront is still Redline Labs black and gold. Default checkout remains bank transfer.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are set. If those are missing, bank-transfer checkout cannot take an order. That is unverified, not a confirmed production failure.

## High Priority Issues

- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026, including the featured Tesamorelin card. `ProductImage` then shows `/brand/vial.png`. Detail is in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/project-overview.md` is behind the code. It still says there is no `vercel.json`, that checkout is Payoneer, and that analytics are absent. `vercel.json` sets the build command, the default payments provider is `bank_transfer`, and `VercelTelemetry` loads the Vercel Analytics and Speed Insights scripts. Other agents that trust the overview will redo finished work or change the wrong payment path.
- `reports/seo-aeo-health.md`, `reports/ecommerce-cro-health.md`, `reports/qa-performance-health.md`, and `reports/security-compliance-health.md` are still scaffolds. Pull request #86 should be recorded by the SEO report, and pull request #88 by the CRO report. Neither should be implemented again.
- Live checkout, the order page, and `/admin/orders` were not exercised after this deploy. Pull request #88 does not change those routes.

## Medium Priority Issues

- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. The hero is decorative (`alt=""`), so this may be intentional. QA should confirm it did not move the largest paint to a late image.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. Pull request #86 added `src/lib/llms.test.ts`, and that file was not executed by CI. Pull request #88 adds no test.
- `npm run check` and `npm test` were not run in this environment. `npm ci` failed twice with `ECONNRESET` while downloading `@neondatabase/serverless` from `registry.npmjs.org`.
- Next.js is pinned at 16.3.4. `SITE_HEALTH.md` notes the 22 September 2026 `ImageResponse` advisory fixed in 16.3.6. This storefront does not import `next/og`. The version bump belongs with security, together with `npm audit`.
- `/order/[reference]` stays publicly readable and shows the customer name, email, and shipping address. Pull request #86 disallows `/order` in `robots.txt`. The page is still reachable by URL. Access control belongs in the security report.

## Low Priority Issues

- The cart drawer’s “Continue shopping” control closes the drawer and leaves the shopper on the current page. The cart page’s “Continue shopping” control is a link to `/shop`, placed under “Continue to checkout”, and only when the cart has lines. The empty cart still uses “Return to catalogue”, which also goes to `/shop`. Both routes exist. The drawer and the cart page do different things under the same label. Conversion copy belongs in `ecommerce-cro-health.md`.
- Footer column labels are paragraphs rather than headings after pull request #86. The links are unchanged.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. That does not change the open-panel layout. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Previously noted unused files were not deleted in this push: root `index.mts` (the `ai` dependency), `src/components/Placeholder.tsx`, and the default `public/*.svg` files. They were not re-checked for new imports.

## Changes Made

No storefront code was changed. Pull request #88 is already on the production branch. It adds the cart-page link and the drawer close button described above. Header, gold and black palette, catalogue data, and checkout were not part of that diff.

This report was refreshed on top of `545b58c`. It keeps the 30 September findings from the unmerged draft pull request #87 and adds the continue-shopping pass. Draft #87 stopped at `9fa5273`.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy. Later production deploys have succeeded. The live URL was not fetched today.

## Tests Performed

- Reviewed `9fa5273..545b58c` (`src/app/cart/page.tsx`, `src/components/CartDrawer.tsx`). `/shop` is a real route. The cart-page control uses the existing `btn-ghost` class. The drawer control is `type="button"` and calls `setDrawerOpen(false)`.
- GitHub Actions run `36697513153` on `545b58c`: success (`lint, typecheck, and build`).
- Commit status for `545b58c`: Vercel context `success`, description "Deployment has completed". GitHub deployment `6756277951` is environment Production and state success.
- `curl` to `https://redlinelabs.shop/cart` and to the Vercel deployment host failed during TLS (exit 35). The continue-shopping control was not clicked in a browser.
- `npm ci` failed with `ECONNRESET` on `@neondatabase/serverless` on two attempts. Local `npm test`, `npm run lint`, and `npm run build` were not run. GitHub Actions remains the build evidence for `545b58c`.

## Build Status

The production-branch build for `545b58c` succeeded in GitHub Actions, and Vercel reported the production deployment complete. This health branch only updates the report. It should not be promoted ahead of the production branch, and it does not need a separate production deploy.

## Outstanding Work

- When egress allows, open a filled cart on desktop and at 390px, use “Continue shopping” on the cart page, and confirm it lands on `/shop`. Open the header cart and confirm “Continue shopping” closes the drawer.
- Confirm PayID and database variables exist in Vercel by name only. Do not copy their values into the repo or this report.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Have the CRO agent write pull request #88 into `ecommerce-cro-health.md`, including the drawer-versus-cart-page label difference.
- Correct `reports/project-overview.md` so the payment provider, `vercel.json`, and analytics match the code.
- Leave the black and gold storefront as it is.

## Recommendations

- Keep specialist agents on their own reports. The cart link in #88 is done; another pass should record it, not add a second control.
- Add `npm test` to CI so new files such as `src/lib/llms.test.ts` actually run before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
- Prefer a preview deployment for the next behaviour change. This branch is a report only. There is no `main` branch.
