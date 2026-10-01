# Redlinelabs Website Health

Last Updated: 30 September 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` at `9fa5273` (pull request #86, search and AI-crawler visibility) passed GitHub CI and the Vercel deployment completed. This environment cannot open a TLS connection to `https://redlinelabs.shop`, so live pages were not re-probed and that failure is not treated as an outage. No new critical break was found in the push. The storefront is still Redline Labs black and gold. Default checkout remains bank transfer.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are set. If those are missing, bank-transfer checkout cannot take an order. That is unverified, not a confirmed production failure.

## High Priority Issues

- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026, including the featured Tesamorelin card. `ProductImage` then shows `/brand/vial.png`. Detail is in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/project-overview.md` is behind the code. It still says there is no `vercel.json`, that checkout is Payoneer, and that analytics are absent. `vercel.json` sets the build command, the default payments provider is `bank_transfer`, and `VercelTelemetry` loads the Vercel Analytics and Speed Insights scripts. Other agents that trust the overview will redo finished work or change the wrong payment path.
- `reports/seo-aeo-health.md`, `reports/ecommerce-cro-health.md`, `reports/qa-performance-health.md`, and `reports/security-compliance-health.md` are still scaffolds. Pull request #86 should be recorded by the SEO report, not implemented again.
- Live checkout, the order page, and `/admin/orders` were not exercised after this deploy.

## Medium Priority Issues

- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. The hero is decorative (`alt=""`), so this may be intentional. QA should confirm it did not move the largest paint to a late image.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. Pull request #86 added `src/lib/llms.test.ts`, and that file was not executed by CI.
- `npm run check` and `npm test` were not run in this environment. `node_modules` is not installed, and this environment has not been able to reach `registry.npmjs.org`.
- Next.js is pinned at 16.3.4. `SITE_HEALTH.md` notes the 22 September 2026 `ImageResponse` advisory fixed in 16.3.6. This storefront does not import `next/og`. The version bump belongs with security, together with `npm audit`.
- `/order/[reference]` stays publicly readable and shows the customer name, email, and shipping address. Pull request #86 disallows `/order` in `robots.txt`. The page is still reachable by URL. Access control belongs in the security report.

## Low Priority Issues

- Footer column labels are paragraphs rather than headings after pull request #86. The links are unchanged.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. That does not change the open-panel layout. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Previously noted unused files were not deleted in this push: root `index.mts` (the `ai` dependency), `src/components/Placeholder.tsx`, and the default `public/*.svg` files. They were not re-checked for new imports.

## Changes Made

No storefront code was changed. Pull request #86 is already on the production branch; this pass did not edit metadata, robots, the sitemap, FAQ copy, or the catalogue.

This report was rewritten to the current health format and fast-forwarded onto `9fa5273`.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy. Later production deploys have succeeded. The live URL was not fetched today.

## Tests Performed

- Reviewed `a07f4e7..9fa5273` (18 files). Routes, footer links, and the 404 page still resolve in code. FAQ answers that contain links stay inside a single paragraph.
- GitHub Actions run `36686939318` on `cursor/redlinelabs-shop-1c01`: success (`lint, typecheck, and build`, about 53 seconds).
- Commit status for `9fa5273`: Vercel context `success`, description "Deployment has completed".
- `curl` to `https://redlinelabs.shop/` failed during TLS (exit 35), including `/shop`, `/llms.txt`, `/sitemap.xml`, `/robots.txt`, and a missing path. Same limit as earlier runs.
- `npm ci` failed with `ECONNRESET` while downloading `@neondatabase/serverless`. Local `npm test`, `npm run lint`, and `npm run build` were not run. GitHub Actions remains the build evidence for `9fa5273`.

## Build Status

The production-branch build for `9fa5273` succeeded in GitHub Actions, and Vercel reported the deployment complete. This health branch only adds the report. It should not be promoted to production unless that is explicitly requested.

## Outstanding Work

- When egress allows, probe home, shop, a product page, cart, checkout, `/llms.txt`, `/sitemap.xml`, `/robots.txt`, and a 404. Confirm the 404 does not advertise the homepage as its canonical URL.
- Confirm PayID and database variables exist in Vercel by name only. Do not copy their values into the repo or this report.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Correct `reports/project-overview.md` so the payment provider, `vercel.json`, and analytics match the code.
- Leave the black and gold storefront as it is.

## Recommendations

- Keep specialist agents on their own reports. The crawler work in #86 is done; another SEO pass should record it, not repeat it.
- Add `npm test` to CI so new files such as `src/lib/llms.test.ts` actually run before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
- Use preview deployments for the next behaviour change. Do not merge to `cursor/redlinelabs-shop-1c01` without an explicit request. There is no `main` branch.
