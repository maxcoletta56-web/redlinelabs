# Redlinelabs Website Health

Last Updated: 5 October 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `1758814` (merge of pull request #95). GitHub Actions run `37387805989` passed lint, typecheck, and build. Vercel production deployment `6871617721` completed successfully. This environment cannot open a TLS connection to `https://redlinelabs.shop` or to the Vercel deployment host, so the new checkout link was reviewed in source and was not clicked on the live site. That TLS failure is not an outage. No new critical break was found in the push. The storefront is still Redline Labs black and gold. Default checkout remains bank transfer.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

The copy of this file on the production branch is still the 25 September scaffold. Later health notes, including the 1 October write-up on draft pull request #94, were never merged. Read this report, not the production copy, until one health pull request is merged.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, or `RESEND_API_KEY` are set. If the PayID or database values are missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. That is unverified, not a confirmed production failure.

## High Priority Issues

- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026, including the featured Tesamorelin card. `ProductImage` then shows `/brand/vial.png`. Detail is in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/project-overview.md` is behind the code. It still says there is no `vercel.json`, that checkout is Payoneer, and that analytics are absent. `vercel.json` sets the build command, the default payments provider is `bank_transfer`, and `VercelTelemetry` loads the Vercel Analytics and Speed Insights scripts. Other agents that trust the overview will redo finished work or change the wrong payment path.
- `reports/seo-aeo-health.md`, `reports/qa-performance-health.md`, `reports/security-compliance-health.md`, and `reports/catalogue-merchandising-health.md` are still the 25 September scaffolds. `reports/ecommerce-cro-health.md` was last edited on 26 September for the Payoneer cutover and does not record bank transfer, the cart continue-shopping links, or the checkout link from pull request #95. Pull request #86 belongs in the SEO report. Pull requests #88, #91, and #95 belong in the CRO report. Pull request #82 belongs in the CRO report as the shared mark-paid receipt, and in the security report only for the admin auth boundary. None of those behaviours should be implemented again.
- Live checkout was not exercised after this deploy. Pull request #95 adds one catalogue link on the filled-cart summary.

## Medium Priority Issues

- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. The hero is decorative (`alt=""`), so this may be intentional. QA should confirm it did not move the largest paint to a late image.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. `src/lib/admin-mark-paid.test.ts` (added in #82) and `src/lib/llms.test.ts` (added in #86) were not executed by CI.
- `npm run check` and `npm test` were not run in this environment. `node_modules` is not installed, and `https://registry.npmjs.org` has failed TLS on earlier passes in this environment. GitHub Actions remains the build evidence for `1758814`.
- Next.js is pinned at 16.3.4. `SITE_HEALTH.md` notes the 22 September 2026 `ImageResponse` advisory fixed in 16.3.6. This storefront does not import `next/og`. The version bump belongs with security, together with `npm audit`.
- `/order/[reference]` stays publicly readable and shows the customer name, email, and shipping address. Pull request #86 disallows `/order` in `robots.txt`. The page is still reachable by URL. Access control belongs in the security report.
- Open pull request #80 still adds `src/lib/record-admin-payment.ts` and also changes the admin login rate limit. Production already sends the receipt through `markOrderPaidWithPaymentEmail` in `src/lib/orders.ts`. Merging #80 on top of #82 would stack a second mark-paid implementation. The rate-limit commit in #80 is a separate security question.
- On viewports below the `lg` breakpoint the checkout summary uses `order-1`, so the new “Continue shopping” link renders above the customer form. The cart page keeps its matching link in the summary column without that reorder. This is layout, not a broken route. The CRO report should record it. Do not add a second checkout link to “fix” the order.

## Low Priority Issues

- Footer column labels are paragraphs rather than headings after pull request #86. The links are unchanged.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. That does not change the open-panel layout. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.
- The checkout link uses `mt-4`. The cart page and cart drawer use `mt-3` on the same `btn-ghost w-full` treatment. The extra pixel step matches the paragraph above it.

## Changes Made

No storefront code was changed in this health pass. Pull request #95 is already on the production branch.

The filled-cart checkout summary now has a `btn-ghost` `Link` to `/shop` labelled “Continue shopping”. It sits after the shipping-policy note, outside the payment form, and it does not clear the cart. `Link` was already imported on the page. The empty checkout state still says “Return to catalogue”. The cart page link from pull request #88 and the drawer link from pull request #91 are unchanged. `ClearCartOnSuccess` stays on the paid success page and `/order/[reference]`.

Header, gold and black palette, catalogue data, and payment behaviour were not part of the #95 diff. The diff is three lines in `src/app/checkout/page.tsx`.

The admin receipt path from pull request #82 is unchanged: the desk and `POST /api/admin/orders/[reference]/paid` share `markOrderPaidWithPaymentEmail`. There is no `src/lib/record-admin-payment.ts` on `1758814`.

This report supersedes the 1 October write-up on draft pull request #94, which stopped at `e85e559`.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy. Later production deploys have succeeded. The live URL was not fetched today.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).
- Filled cart and cart drawer already link back to `/shop` (pull requests #88 and #91).

## Tests Performed

- Reviewed `e85e559..1758814`. One file: `src/app/checkout/page.tsx`, three added lines.
- Confirmed the new control is an anchor to `/shop`, uses the existing `btn-ghost` class, and is outside the checkout `<form>`.
- Confirmed the cart page and cart drawer already use the same label and destination, and that those controls do not clear the cart.
- GitHub Actions run `37387805989` on `1758814`: success (`lint, typecheck, and build`).
- Commit status for `1758814`: Vercel context `success`, description "Deployment has completed". GitHub deployment `6871617721` is environment Production, state success, created 5 October 2026.
- `curl` to `https://redlinelabs.shop/` and `https://redlinelabs.shop/checkout` failed during TLS (`SSL_ERROR_SYSCALL`, exit 35). The Vercel deployment host failed the same way. Core routes were not loaded in a browser.
- Local `npm test`, `npm run lint`, and `npm run build` were not run. `node_modules` is absent. GitHub Actions remains the build evidence for `1758814`.

## Build Status

The production-branch build for `1758814` succeeded in GitHub Actions, and Vercel reported production deployment `6871617721` complete. This health branch only updates the report. It should not be promoted ahead of the production branch, and it does not need a separate production deploy.

## Outstanding Work

- When egress allows, open checkout with a filled cart on desktop and at 390px. Use “Continue shopping” and confirm it lands on `/shop` with the lines still in the cart. Confirm the empty checkout state still says “Return to catalogue”.
- When egress allows, sign in to `/admin/orders` and mark one awaiting-payment order paid. Confirm the desk shows the paid notice and that a second mark does not send another receipt. Leave `ADMIN_API_SECRET` and `RESEND_API_KEY` out of the repo and this report.
- Confirm PayID, database, and Resend variables exist in Vercel by name only.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Have the CRO agent write pull requests #88, #91, #95, and #82 into `ecommerce-cro-health.md`. The checkout link already exists. The CRO pass should record the mobile summary order, not add another control.
- Correct `reports/project-overview.md` so the payment provider, `vercel.json`, and analytics match the code.
- Merge one current health report onto the production branch when that merge is explicitly requested, then close the older health drafts (#94 and earlier) so the next agent does not audit from the 25 September scaffold.
- Leave the black and gold storefront as it is.

## Recommendations

- Keep a single “Continue shopping” link on checkout. The cart page and the cart drawer already have theirs. Do not add a fourth.
- Keep the mark-paid receipt on `markOrderPaidWithPaymentEmail`. Do not add `record-admin-payment.ts` back, and do not merge pull request #80’s copy of that path.
- Keep specialist agents on their own reports. The checkout link in #95 is done. Another pass should record it, not rebuild it.
- Add `npm test` to CI so the library tests run before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
- Do not merge draft pull request #94 after this report. It describes production as `e85e559` and would overwrite this #95 note.
