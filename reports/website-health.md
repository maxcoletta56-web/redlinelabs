# Redlinelabs Website Health

Last Updated: 1 October 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `e85e559` (merge of pull request #82). GitHub Actions run `36855258888` passed lint, typecheck, and build. Vercel production deployment `6783019958` completed successfully. This environment cannot open a TLS connection to `https://redlinelabs.shop`, so the admin receipt change was reviewed in source and was not clicked on the live site. That TLS failure is not an outage. No new critical break was found in the push. The storefront is still Redline Labs black and gold. Default checkout remains bank transfer.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, or `RESEND_API_KEY` are set. If the PayID or database values are missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. That is unverified, not a confirmed production failure.

## High Priority Issues

- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026, including the featured Tesamorelin card. `ProductImage` then shows `/brand/vial.png`. Detail is in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/project-overview.md` is behind the code. It still says there is no `vercel.json`, that checkout is Payoneer, and that analytics are absent. `vercel.json` sets the build command, the default payments provider is `bank_transfer`, and `VercelTelemetry` loads the Vercel Analytics and Speed Insights scripts. Other agents that trust the overview will redo finished work or change the wrong payment path.
- `reports/seo-aeo-health.md`, `reports/ecommerce-cro-health.md`, `reports/qa-performance-health.md`, `reports/security-compliance-health.md`, and `reports/catalogue-merchandising-health.md` are still the 25 September scaffolds. Pull request #86 belongs in the SEO report. Pull requests #88 and #91 belong in the CRO report. Pull request #82 belongs in the CRO report as the shared mark-paid receipt, and in the security report only for the admin auth boundary. None of those behaviours should be implemented again.
- Live checkout, the order page, and `/admin/orders` were not exercised after this deploy. Pull request #82 changes the admin mark-paid path only.

## Medium Priority Issues

- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. The hero is decorative (`alt=""`), so this may be intentional. QA should confirm it did not move the largest paint to a late image.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. `src/lib/admin-mark-paid.test.ts` (added in #82) and `src/lib/llms.test.ts` (added in #86) were not executed by CI.
- `npm run check` and `npm test` were not run in this environment. `https://registry.npmjs.org` failed during TLS (curl exit 35), and `node_modules` is not installed.
- Next.js is pinned at 16.3.4. `SITE_HEALTH.md` notes the 22 September 2026 `ImageResponse` advisory fixed in 16.3.6. This storefront does not import `next/og`. The version bump belongs with security, together with `npm audit`.
- `/order/[reference]` stays publicly readable and shows the customer name, email, and shipping address. Pull request #86 disallows `/order` in `robots.txt`. The page is still reachable by URL. Access control belongs in the security report.
- Open pull request #80 still adds `src/lib/record-admin-payment.ts` and also changes the admin login rate limit. Production already sends the receipt through `markOrderPaidWithPaymentEmail` in `src/lib/orders.ts`. Merging #80 on top of #82 would stack a second mark-paid implementation. The rate-limit commit in #80 is a separate security question.

## Low Priority Issues

- Footer column labels are paragraphs rather than headings after pull request #86. The links are unchanged.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. That does not change the open-panel layout. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.

## Changes Made

No storefront code was changed in this health pass. Pull request #82 is already on the production branch.

The admin desk and `POST /api/admin/orders/[reference]/paid` now share `markOrderPaidWithPaymentEmail`. The desk reaches it through `settleAdminOrderPaid` in `src/lib/admin-mark-paid.ts`. The bearer route calls it directly after the existing auth, reference, and `ordersConfigured` checks. The helper looks up the order, marks it paid, and schedules the payment-received email when the looked-up status was not already `paid`. A lookup failure is logged and the update still proceeds, which also schedules the email. A mail failure is logged and the paid result stands. There is no `src/lib/record-admin-payment.ts` on this commit.

Header, gold and black palette, catalogue data, cart continue-shopping links, and checkout were not part of the #82 diff.

The filled-cart drawer “Continue shopping” control from pull request #91 remains a `btn-ghost` `Link` to `/shop` that only calls `setDrawerOpen(false)`. The cart page uses the same destination when the cart has lines. `ClearCartOnSuccess` stays on the paid success page and `/order/[reference]`.

This report was refreshed from the 30 September write-up on draft pull request #92, which stopped at `1524a84`. That draft still describes production as the cart-drawer deploy.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy. Later production deploys have succeeded. The live URL was not fetched today.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).

## Tests Performed

- Reviewed `1524a84..e85e559`. Five files: `src/lib/orders.ts`, `src/lib/admin-mark-paid.ts`, `src/lib/admin-mark-paid.test.ts`, `src/app/admin/orders/actions.ts`, and `src/app/api/admin/orders/[reference]/paid/route.ts`.
- Read the four tests in `admin-mark-paid.test.ts`: first transition sends one receipt, an already-paid order sends none, a thrown mail error still returns `notice=paid`, and a lookup failure still marks the order paid and schedules one email. The logged lookup error in that test does not include the customer email address. The tests were read, not executed.
- Confirmed `record-admin-payment.ts` is absent at `e85e559`.
- GitHub Actions run `36855258888` on `e85e559`: success (`lint, typecheck, and build`).
- Commit status for `e85e559`: Vercel context `success`, description "Deployment has completed". GitHub deployment `6783019958` is environment Production, state success, created 1 October 2026.
- `curl` to `https://redlinelabs.shop/` failed during TLS (`SSL_ERROR_SYSCALL`). Core routes were not loaded in a browser.
- `curl` to `https://registry.npmjs.org/next` failed during TLS (exit 35). Local `npm test`, `npm run lint`, and `npm run build` were not run. GitHub Actions remains the build evidence for `e85e559`.

## Build Status

The production-branch build for `e85e559` succeeded in GitHub Actions, and Vercel reported production deployment `6783019958` complete. This health branch only updates the report. It should not be promoted ahead of the production branch, and it does not need a separate production deploy.

## Outstanding Work

- When egress allows, sign in to `/admin/orders` and mark one awaiting-payment order paid. Confirm the desk shows the paid notice and that a second mark does not send another receipt. Leave `ADMIN_API_SECRET` and `RESEND_API_KEY` out of the repo and this report.
- When egress allows, open a filled cart on desktop and at 390px. Use “Continue shopping” in the drawer and confirm it lands on `/shop` with the drawer shut and the lines still in the cart.
- Confirm PayID, database, and Resend variables exist in Vercel by name only.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Have the CRO agent write pull requests #88, #91, and #82 into `ecommerce-cro-health.md`.
- Correct `reports/project-overview.md` so the payment provider, `vercel.json`, and analytics match the code.
- Leave the black and gold storefront as it is.

## Recommendations

- Keep the mark-paid receipt on `markOrderPaidWithPaymentEmail`. Do not add `record-admin-payment.ts` back, and do not merge pull request #80’s copy of that path.
- Keep specialist agents on their own reports. The receipt behaviour in #82 is done. Another pass should record it, not add a third sender.
- Add `npm test` to CI so `src/lib/admin-mark-paid.test.ts` runs before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
