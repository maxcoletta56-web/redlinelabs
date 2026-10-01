# Redlinelabs Website Health

Last Updated: 30 September 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `1524a84` (pull request #91). GitHub CI passed and the Vercel production deployment completed. This environment cannot open a TLS connection to `https://redlinelabs.shop`, so the cart drawer change was reviewed in source and was not clicked on the live site. That TLS failure is not an outage. No new critical break was found in the push. The storefront is still Redline Labs black and gold. Default checkout remains bank transfer.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are set. If those are missing, bank-transfer checkout cannot take an order. That is unverified, not a confirmed production failure.

## High Priority Issues

- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026, including the featured Tesamorelin card. `ProductImage` then shows `/brand/vial.png`. Detail is in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/project-overview.md` is behind the code. It still says there is no `vercel.json`, that checkout is Payoneer, and that analytics are absent. `vercel.json` sets the build command, the default payments provider is `bank_transfer`, and `VercelTelemetry` loads the Vercel Analytics and Speed Insights scripts. Other agents that trust the overview will redo finished work or change the wrong payment path.
- `reports/seo-aeo-health.md`, `reports/ecommerce-cro-health.md`, `reports/qa-performance-health.md`, `reports/security-compliance-health.md`, and `reports/catalogue-merchandising-health.md` are still the 25 September scaffolds. Pull request #86 should be recorded by the SEO report, and pull requests #88 and #91 by the CRO report. Neither control should be implemented again.
- Live checkout, the order page, and `/admin/orders` were not exercised after this deploy. Pull request #91 does not change those routes.

## Medium Priority Issues

- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. The hero is decorative (`alt=""`), so this may be intentional. QA should confirm it did not move the largest paint to a late image.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. Pull request #86 added `src/lib/llms.test.ts`, and that file was not executed by CI. Pull request #91 adds no test.
- `npm run check` and `npm test` were not run in this environment. `https://registry.npmjs.org` failed during TLS (curl exit 35), and `node_modules` is not installed.
- Next.js is pinned at 16.3.4. `SITE_HEALTH.md` notes the 22 September 2026 `ImageResponse` advisory fixed in 16.3.6. This storefront does not import `next/og`. The version bump belongs with security, together with `npm audit`.
- `/order/[reference]` stays publicly readable and shows the customer name, email, and shipping address. Pull request #86 disallows `/order` in `robots.txt`. The page is still reachable by URL. Access control belongs in the security report.
- The filled-cart drawer footer is taller. “Continue shopping” is now a full-width `btn-ghost` under “View cart”, which was previously a text control. The line list is the scrolling region. A 390px check should confirm the footer, including the safe-area padding, still leaves the cart lines usable.

## Low Priority Issues

- Footer column labels are paragraphs rather than headings after pull request #86. The links are unchanged.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. That does not change the open-panel layout. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Previously noted unused files were not deleted in this push: root `index.mts` (the `ai` dependency), `src/components/Placeholder.tsx`, and the default `public/*.svg` files. They were not re-checked for new imports.

## Changes Made

No storefront code was changed in this health pass. Pull request #91 is already on the production branch. In `src/components/CartDrawer.tsx`, the filled-cart “Continue shopping” control is a `Link` to `/shop` with `className="btn-ghost mt-3 w-full"`. Its click handler calls `setDrawerOpen(false)` only. `Link` was already imported. The same footer still has Checkout (`/checkout`) and View cart (`/cart`), both of which also close the drawer.

The cart page already links “Continue shopping” to `/shop` with `btn-ghost mt-3 w-full` when the cart has lines. The empty drawer still says “Return to catalogue” and links to `/shop`. Header, gold and black palette, catalogue data, and checkout were not part of the #91 diff.

Cart contents stay put on that navigation. `ClearCartOnSuccess` is rendered from the paid checkout success page and from `/order/[reference]`, not from `/shop`.

This report was refreshed on top of `1524a84`. It keeps the 30 September findings from draft pull request #89 and records the drawer change. Draft #89 stopped at `545b58c` and still says the drawer control only closes. That description is out of date.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy. Later production deploys have succeeded. The live URL was not fetched today.
- The drawer and the cart page used the same “Continue shopping” label for different actions. Pull request #91 makes the filled-cart drawer control a catalogue link as well.

## Tests Performed

- Reviewed `545b58c..1524a84`. The only file in the diff is `src/components/CartDrawer.tsx` (4 lines). `/shop` is an existing route. The new control uses the same `btn-ghost` plus `w-full` pattern as the cart page link. `.btn-ghost` is `inline-flex` with centered content, so `w-full` makes it a full-width button.
- Confirmed the empty-cart drawer link and the cart-page link still point at `/shop`.
- GitHub Actions run `36746556433` on `1524a84`: success (`lint, typecheck, and build`).
- Commit status for `1524a84`: Vercel context `success`, description "Deployment has completed". GitHub deployment `6764984816` is environment Production, state success, created 30 September 2026.
- `curl` to `https://redlinelabs.shop/cart` failed during TLS (exit 35). The continue-shopping control was not clicked in a browser.
- `curl` to `https://registry.npmjs.org/next` failed during TLS (exit 35). Local `npm test`, `npm run lint`, and `npm run build` were not run. GitHub Actions remains the build evidence for `1524a84`.

## Build Status

The production-branch build for `1524a84` succeeded in GitHub Actions, and Vercel reported production deployment `6764984816` complete. This health branch only updates the report. It should not be promoted ahead of the production branch, and it does not need a separate production deploy.

## Outstanding Work

- When egress allows, open a filled cart on desktop and at 390px. Use “Continue shopping” in the drawer and confirm it lands on `/shop` with the drawer shut and the lines still in the cart. Repeat from the cart page. On an empty drawer, “Return to catalogue” should still open `/shop`.
- Confirm PayID and database variables exist in Vercel by name only. Do not copy their values into the repo or this report.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Have the CRO agent write pull requests #88 and #91 into `ecommerce-cro-health.md`. The drawer and cart page now share the catalogue destination.
- Correct `reports/project-overview.md` so the payment provider, `vercel.json`, and analytics match the code.
- Leave the black and gold storefront as it is.

## Recommendations

- Keep specialist agents on their own reports. The catalogue link in #91 is done. Another pass should record it, not add a third continue-shopping control.
- Add `npm test` to CI so new files such as `src/lib/llms.test.ts` actually run before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
- Prefer a preview deployment for the next behaviour change. This branch is a report only. There is no `main` branch. Production is `cursor/redlinelabs-shop-1c01`.
