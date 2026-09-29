# Redlinelabs Website Health

Last Updated: 29 September 2026

Overall Status: Production is commit `a07f4e7` (merge of pull request #83, shipping address at checkout). GitHub Actions run [36628125896](https://github.com/maxcoletta56-web/redlinelabs/actions/runs/36628125896) passed lint, typecheck, and build. Vercel production deployment `6745019760` completed successfully. No critical defect was found in that merge. This environment cannot open TLS to `https://redlinelabs.shop`, so live pages were not loaded. The storefront brand is Redline Labs black and gold. This pass did not change it.

This file is the umbrella for build, deploy, and route health. SEO, catalogue, conversion, tests, and secrets stay in the sibling reports.

## Critical Issues

None found in this pass. The shipping-address merge compiled in CI, and Vercel marked the production deployment complete.

The 25 September note that production still turned a browser store-credit balance into a coupon is closed. Checkout shows that balance as $0.00 and does not send it to the payment rail.

## High Priority Issues

- Live checkout after this deploy is unconfirmed. A green Vercel build does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, and `DATABASE_URL` are set. `GET /api/checkout` returns `configured: false` until both the PayID details and the database are present, and the checkout button stays disabled. `curl` to the shop failed with TLS error 35, so `/`, `/shop`, `/checkout`, and product pages were not observed.
- Open pull requests still replace checkout. Whop card work is in #81, #79, #78, #77, #70, #66, #65, #61, #60, and #58. #67 reverts checkout to Stripe. Merging any of those without rebasing onto `a07f4e7` can drop the required Australian shipping address. The CRO agent owns that design. This pass does not start another payment integration.

## Medium Priority Issues

- `reports/project-overview.md` still describes Payoneer as the payment path and says the repo has no `vercel.json`. The default rail is bank transfer. `vercel.json` runs the comments and orders schema scripts before `next build`. Left untouched so this change stays the health report.
- Checkout collects the address inline. The account page still uses `AddressForm`. The two forms can drift. CRO should reconcile them. The form that just shipped was not rewritten here.
- CI runs lint, typecheck, and build. It does not run `npm test`. Shipping coverage landed in `src/lib/bank-transfer-checkout.test.ts` and `src/lib/order-shipping.test.ts`. QA owns adding the test script to CI.
- Catalogue image failures, product JSON-LD, and browser-local accounts were not re-audited. They stay with `catalogue-merchandising-health.md`, `seo-aeo-health.md`, and `security-compliance-health.md`.

## Low Priority Issues

- Dead code is still in the tree. Root `index.mts` is the only consumer of the `ai` dependency and is not imported by the App Router. `src/components/Placeholder.tsx` has no callers. QA can remove both in a cleanup of its own.
- Older health-report pull requests #56, #59, #64, #69, #75, and #76 describe earlier deploys. Merging them would roll this snapshot backwards.

## Changes Made

- Recorded the production push of pull request #83 in this report.
- No storefront code, catalogue data, styling, or environment values were changed.
- Guest checkout on `a07f4e7` refuses an order without address line 1, a suburb or city, an Australian state or territory, and a 4-digit postcode. The address is stored on the order, shown on `/order/[reference]` and `/admin/orders`, and included in the order email. Older rows with no address render as "No address on file".

## Tests Performed

- Reviewed the #83 diff: checkout form, `createBankTransferOrder`, order page, admin desk, checkout validation, and the mailer address lines.
- Confirmed Actions run 36628125896 (`lint, typecheck, and build`) succeeded on `a07f4e7`.
- Confirmed Vercel production deployment `6745019760` state is `success` (target `https://redlinelabs-7aaoyznjl-metrouniforms.vercel.app`).
- `curl` to `https://redlinelabs.shop/` and `/checkout` failed with TLS error 35. HTTP status was not observed.
- `npm run check` was not run here. `node_modules` is absent, and `registry.npmjs.org` fails with the same TLS error. The report is the only edit on this branch. The build evidence is the Actions run on the production commit.

## Build Status

Passed on GitHub Actions for `a07f4e7` on 29 September 2026 (run 36628125896, about 42 seconds). Vercel production deployment `6745019760` completed. Local `npm run check` was not run.

## Outstanding Work

- From a network that can reach the shop, open `/checkout` with an item in the cart. Confirm the address fields, whether the payment button is enabled, and that a blank address does not create an order. Do not submit a live payment unless explicitly asked.
- Rebase the open checkout pull requests onto `a07f4e7` before any merge.
- Have QA run `npm test` on `a07f4e7`. CI does not.
- Do not promote or redeploy. This push already deployed because it landed on `cursor/redlinelabs-shop-1c01`.

## Recommendations

- Keep specialist ownership. SEO, catalogue, CRO, QA, and security write their own reports. This file stays the record of whether the site builds, deploys, and can serve its routes.
- Keep feature work off `cursor/redlinelabs-shop-1c01`. That branch is what Vercel deploys to production.
- Keep the Redline Labs black and gold storefront.
- Refresh `reports/project-overview.md` in its own change so later agents do not treat Payoneer as the default rail.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | First audit. Render and deploy findings stayed here. Checkout, security, SEO, catalogue, and test findings were handed to the sibling reports. |
| 2026-09-29 | website health | Recorded production `a07f4e7` (PR #83). Closed the stale store-credit coupon note. No storefront code changes. |
