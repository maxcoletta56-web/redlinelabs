# Redlinelabs Website Health

Last Updated: 26 September 2026

Overall Status: Production is running the Payoneer checkout build (`bb25410`, deployment `6677791011`, state success). Stripe no longer creates charges. A completed Payoneer payment was not recorded on the merged pull request, and this environment cannot open `https://redlinelabs.shop` (TLS fails with `SSL_ERROR_SYSCALL`). Treat live checkout as unverified. The storefront is still the Redline Labs black and gold design. Do not redeploy or purge the domain from this pass.

## Critical Issues

- Live checkout can be down. Pull request `#49` removed Stripe and now requires `PAYONEER_MERCHANT_CODE` and `PAYONEER_PAYMENT_TOKEN`. Without both, `GET /api/checkout` reports `configured: false`, the checkout button stays disabled, and `POST` returns 503. The pull request test plan (sandbox payment, 503 check, cart clear) was still unchecked at merge. This environment cannot read Vercel environment names or the live site, so it cannot tell whether those two variables are set. Do not print or pull their values.

## High Priority Issues

- Guest checkout does not collect a shipping address. The shipping policy says checkout collects an Australian address before Payoneer takes payment. The form only offers saved addresses for a signed-in account. The Payoneer list body (`src/lib/checkout-session.ts`) sends country `AU`, customer name, email, amount, and callback URLs. It does not send a street, suburb, state, or postcode. Stripe previously required billing and Australian shipping. A guest can pay with no ship-to stored for fulfilment. Orders are still written in the browser, not on the server.
- Payment confirmation depends on the customer returning within 30 minutes. The receipt (email, lines, shipping, list URL) sits in the httpOnly cookie `rl_payoneer_checkout`. `POST /api/checkout/notify` answers `{ status: "ok" }` and stores nothing. `/checkout/success` shows "Payment not confirmed" when that cookie is missing, or when `session_id` is present and is not the transaction id, the list long id, or the list transaction id. The cart clears only after Payoneer status `charged` or `paid`.
- `reports/security-compliance-health.md` still documents Stripe keys as the checkout secret. `reports/ecommerce-cro-health.md` still describes embedded Stripe in its current status and only adds a one-line changelog. Leave those reports to their owners. Do not put Stripe back.

## Medium Priority Issues

- `env.example` told operators to set `STRIPE_REQUIRE_LIVE`. The code reads `PAYONEER_REQUIRE_LIVE`. That comment is corrected in this pass. CI (`.github/workflows/ci.yml`) still injects Stripe placeholder key names. The build does not read them.
- Checkout no longer imports Stripe. `src/lib/stripe.ts` is gone. `src/lib/stripe-keys.ts`, `stripeCouponParams` in `src/lib/promo.ts`, and their tests remain. They do not affect the Payoneer charge.
- A charged list is trusted without comparing Payoneer's amount and currency to the catalogue total in the receipt.
- `POST /api/checkout` does not pass `shipping` into `createPayoneerCheckout`. The checkout page uses the server action, which does pass a saved address.
- `npm run lint` passes with one warning: `src/app/global-error.tsx` uses `window.location.assign("/")`.
- `npm test` warns that `package.json` has no `"type": "module"`.
- Content-Security-Policy is still report-only. `form-action` allows the Payoneer hosted page hosts. The browser leaves via `window.location.assign`, which that directive does not govern.
- Local `next build` in this environment has been failing on the Inter font fetch from `fonts.googleapis.com` (egress). Not re-run this pass. GitHub Actions run `36236155123` on `#49` completed lint, typecheck, and build successfully.

## Low Priority Issues

- `SITE_HEALTH.md` still describes Stripe.js and embedded checkout.
- Dead code carried forward from 25 September and still present: root `index.mts` (only consumer of the `ai` dependency), `src/components/Placeholder.tsx`.
- Catalogue image failures, slug spelling, and JSON-LD stock flags stay with the catalogue and SEO reports. Not re-tested today.

## Changes Made

- Recorded the Payoneer production deploy and the checkout gaps above.
- `env.example` now names `PAYONEER_REQUIRE_LIVE` instead of `STRIPE_REQUIRE_LIVE`.
- `reports/project-overview.md` now points at `src/app/actions/checkout.ts`, counts 43 unit tests, and names `PAYONEER_REQUIRE_LIVE`.
- No visual change. Header, gold and black palette, catalogue data, and the DGC20 promo are unchanged. No production deploy was triggered from this pass.

## Tests Performed

- `npm test`: 43 passed, 0 failed, including `src/lib/payoneer.test.ts`.
- `npm run lint`: passed, with the `global-error.tsx` warning above.
- `npm run typecheck`: passed.
- GitHub Actions on `bb25410` (run `36236155123`): lint, typecheck, and build succeeded before merge.
- Vercel production deployment `6677791011` for `bb25410`: success. Preview for the pull request also succeeded.
- `curl` to `https://redlinelabs.shop` failed with `SSL_ERROR_SYSCALL`. No page was loaded. No card payment was submitted.

## Build Status

The production build of the Payoneer commit succeeded on GitHub Actions and on Vercel. This environment did not run `next build` again. The parent commit's CI build is the evidence for that code. Documentation edits in this pass are not part of the Next.js compile.

## Outstanding Work

- Confirm on Vercel that production has `PAYONEER_MERCHANT_CODE` and `PAYONEER_PAYMENT_TOKEN`, then complete one sandbox or live payment and a return to `/checkout/success`. Do not paste the values into the repo, a report, or a pull request.
- Collect an Australian shipping address for every checkout, including guests, and send it to Payoneer with the list. Hand this to the e-commerce report. Do not invent the list address fields without the Payoneer list schema.
- Decide whether `POST /api/checkout/notify` should verify a Payoneer notification before any order is accepted. Today it cannot accept one.
- Security report: replace the Stripe secret table with the Payoneer variable names. Do not log values.
- Re-check `/product/bacterial-water` on the live site when egress allows it. Later production deploys may have published the listing that was cached as 404 on 25 September. Do not purge the cache from here.
- Keep the Redline Labs black and gold storefront. A historical branch named `cursor/metro-uniforms-about-151c` is not the current brand.

## Recommendations

- Leave checkout code as it is until a Payoneer sandbox payment is possible. A wrong list payload would turn a missing address into a failed charge.
- After credentials are confirmed, add the shipping address on our form first, then add only the address fields Payoneer's list API documents.
- Point CI placeholders at `PAYONEER_MERCHANT_CODE` and `PAYONEER_PAYMENT_TOKEN` (empty), and delete the unused Stripe key helpers in a separate change so promo tests are updated with them.
- Use a Vercel preview for that follow-up. Do not promote it to production without an explicit request.

## Scope

This report is the umbrella for build, deploy, and core route health: home, shop, product, cart, checkout, account, and policy pages, plus header, footer, and error pages. Search and schema belong in `seo-aeo-health.md`. Catalogue data belongs in `catalogue-merchandising-health.md`. Cart and conversion tuning belong in `ecommerce-cro-health.md`. Test budgets belong in `qa-performance-health.md`. Secrets and compliance belong in `security-compliance-health.md`.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into this scaffold. |
| 2026-09-26 | website health | Payoneer is the production checkout. Recorded the unverified credential cutover, the missing guest shipping address, and the no-op payment notification. |
