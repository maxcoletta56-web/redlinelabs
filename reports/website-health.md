# Redlinelabs Website Health

Last Updated: 8 October 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `efe984f` (merge of pull request #105). GitHub Actions run `37710478087` passed lint, typecheck, and build. Vercel production deployment `6924553393` completed successfully. This environment cannot open a TLS connection to `https://redlinelabs.shop` or `*.vercel.app`, so the new checkout choice was reviewed in source and was not clicked on the live site. That TLS failure is not an outage. No render or build break was found in the push. The storefront is still Redline Labs black and gold. PayID stays the default. PayPal is an extra choice when its credentials are present, unless `NEXT_PUBLIC_PAYMENTS_PROVIDER` is `bank_transfer_only`.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

The copy of this file on the production branch was the 25 September scaffold. Draft pull request #103 recorded production at `78e01b6` and was not merged. Do not merge #103 after this report. It says PayPal runs only when the public flag is `paypal`, which pull request #105 changed.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `RESEND_API_KEY`, `PAYPAL_CLIENT_ID`, or `PAYPAL_CLIENT_SECRET` are set. If PayID or the database is missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. PayPal stays hidden until its two secrets are set. That is unverified, not a confirmed production failure.

The orders migration backfills `payment_method` and `paypal_order_id` from `db/orders.sql` during the Vercel build when `DATABASE_URL` is set. Deployment `6924553393` succeeded, so the script did not refuse the build. If the database URL was unset, the script skips and a later insert would fail on the new columns. Confirm those two columns exist before treating a checkout error as an application bug.

## High Priority Issues

- Pull request #105 offers PayPal beside PayID and writes both through the same order row. Do not add a second PayPal client, and do not set `NEXT_PUBLIC_PAYMENTS_PROVIDER`. `bank_transfer_only` is the kill switch. CRO owns any change to the default rail.
- Unchecked Remember me still stores the account email in the client-readable cookie `rl_account_session`. The checked path, which is the default, keeps the sign-in in `localStorage` under `redline-session-v1`. Security owns that follow-up. Do not rebuild sign-in.
- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026. `ProductImage` then shows `/brand/vial.png`. Detail belongs in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/ecommerce-cro-health.md` still describes Stripe embedded checkout. It does not record bank transfer, PayPal, the continue-shopping links, Remember me, or the #105 choice. The SEO, QA, security, and catalogue reports are still the 25 September scaffolds. Record those deploys in the owning reports. Do not implement the behaviour again.

## Medium Priority Issues

- `GET /api/checkout` sets `paypalOffered` to `showChoice`. That is true only when both rails can run. A PayPal-only response has `defaultMethod: "paypal"` and `paypalOffered: false`. The cart and checkout pages read `showChoice` and `defaultMethod`, so the page still follows the PayPal-only path. Nothing else reads the mismatched field. CRO can correct the field when it next touches that route.
- `/checkout/success` still confirms a PayPal capture from the httpOnly cookie `rl_paypal_checkout` (30 minutes, path `/`). The cookie holds the receipt, including email and shipping. Bank-transfer buyers stay on `/order/[reference]`. An unfinished PayPal return now offers retry and a PayID link on the same order. Do not point bank-transfer orders at `/checkout/success`.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. `src/lib/paypal-checkout.test.ts` did not run in Actions run `37710478087`.
- Inter is now a self-hosted variable font (`src/app/fonts/InterVariable.woff2`, about 352 KB) via `next/font/local`. The production build no longer fetches Google Fonts. QA should confirm the font file is the first paint face and that the extra weight range is worth the bytes.
- `node_modules` is absent here and this environment cannot reach `registry.npmjs.org`, so this pass did not run `npm run check` locally. GitHub Actions remains the build evidence for `efe984f`.

## Low Priority Issues

- Content-Security-Policy is still report-only. `form-action` allows `https://www.paypal.com` and `https://www.sandbox.paypal.com`. Card checkout redirects the browser to PayPal from the server approval URL.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.
- The test runner still warns that `package.json` has no `"type": "module"` when loading TypeScript tests.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- The cart drawer, cart page, and checkout still have one “Continue shopping” link each. The drawer now also shows the payment choice when both rails are available. That choice does not clear the cart.

## Changes Made

No storefront code was changed in this health pass. Pull request #105 is already on the production branch.

PayPal is offered beside PayID. `src/components/PaymentMethodChoice.tsx` renders the choice. `src/lib/paypal-checkout.ts` inserts an unpaid order before the redirect and records the PayPal order id. `payment_method` and `paypal_order_id` are on `db/orders.sql`. The build migration adds missing columns without dropping rows. A failed PayPal call after the row is saved sends the buyer to `/order/[reference]?paypal=unavailable`, where they can retry PayPal or pay by PayID. Header, gold and black palette, and catalogue data were not part of the #105 diff.

Inter is loaded from `src/app/fonts/InterVariable.woff2` in `src/app/layout.tsx`. `next/font/google` is no longer imported.

`reports/project-overview.md` now matches that checkout. The production copy had been left on the #102 wording (PayPal only when the public flag is `paypal`, and no `vercel.json`).

Remember me from pull request #97 is unchanged. The continue-shopping links from pull requests #88, #91, and #95 are unchanged. Do not add another. The admin receipt path from pull request #82 is unchanged.

This report supersedes the 6 October write-up on draft pull request #103, which stopped at `78e01b6`.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).
- Filled cart, cart drawer, and checkout already link back to `/shop` (pull requests #88, #91, and #95).
- Account sign-in has Remember me, checked by default (pull request #97).
- PayPal guest card checkout replaced Stripe and Payoneer (pull request #102). #105 keeps that client and adds it as a choice next to PayID.

## Tests Performed

- Reviewed `78e01b6..efe984f` (25 files). Added `PaymentMethodChoice`, `paypal-checkout.ts`, and the two order columns. Checkout, the cart drawer, the cart page, the order page, and the success page branch on the selected method.
- Confirmed `checkoutPaymentChoices` shows both methods only when PayPal credentials exist and bank transfer is configured, and that `bank_transfer_only` hides PayPal.
- Confirmed an omitted `paymentMethod` still follows the legacy rail: PayID unless `paymentsProvider()` is `paypal` and PayPal is offered.
- Confirmed bank transfer still redirects to `/order/{reference}`. PayPal capture still returns through `/checkout/success`.
- Confirmed the cart drawer “Continue shopping” link still goes to `/shop` and only closes the drawer.
- Confirmed `src/app/layout.tsx` uses `next/font/local` and no longer imports `next/font/google`.
- GitHub Actions run `37710478087` on `efe984f`: success (lint, typecheck, and build).
- GitHub deployment `6924553393` for `efe984f`: environment Production, state success, created 8 October 2026. Vercel status on the commit is success.
- `npm test` and `npm run check` were not run locally. `node_modules` is absent and this environment cannot reach `registry.npmjs.org`.
- The live site and the Vercel deployment URL were not opened. Checkout was not submitted.

## Build Status

The production-branch build for `efe984f` succeeded in GitHub Actions, and Vercel reported production deployment `6924553393` complete. This health branch updates the report and the project overview. It should not be promoted ahead of an explicit request, and it does not need a separate production deploy.

## Outstanding Work

- CRO: record pull request #105 in `ecommerce-cro-health.md`. The choice already exists. Do not add another payment client, and do not change `NEXT_PUBLIC_PAYMENTS_PROVIDER` unless that change is explicitly requested.
- Security: record PayPal credential handling, the `rl_paypal_checkout` receipt cookie, the Remember me cookie, and the public `paypalConfigured` / `bankTransferConfigured` booleans on `GET /api/checkout`. Leave secret values out of the repo and this report.
- When egress allows, open `/`, `/shop`, `/checkout`, and `/cart` and confirm they return 200. With PayPal secrets unset, checkout copy should describe PayID only and the choice should be absent. Do not submit a payment.
- When egress allows, confirm an existing `/order/[reference]` still renders. A missing `payment_method` column would 500 that page.
- Confirm PayID, database, and Resend variables exist in Vercel by name only. Confirm the orders table has `payment_method` and `paypal_order_id`.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Merge one current health report onto the production branch only when that merge is explicitly requested. Then close the older health drafts (#103 and earlier) so the next agent does not audit from the 25 September scaffold.
- Leave the black and gold storefront as it is. Do not apply a Metro Uniforms redesign.

## Recommendations

- Keep PayID as the default rail. Offer PayPal only when its secrets are set. Use `bank_transfer_only` to hide it. Do not infer the card rail from the presence of `src/lib/paypal.ts`.
- Keep a single PayPal implementation in `src/lib/paypal.ts`, `src/lib/paypal-checkout.ts`, and `src/lib/checkout-session.ts`. Do not restore `payoneer.ts` or `stripe-keys.ts`.
- Keep the mark-paid receipt on `markOrderPaidWithPaymentEmail`. Do not add `record-admin-payment.ts` back, and do not merge pull request #80’s copy of that path.
- Keep one “Continue shopping” link on checkout, the cart page, and the cart drawer.
- Keep specialist agents on their own reports. The next CRO pass should record #105, not rebuild it.
- Add `npm test` to CI so `src/lib/paypal-checkout.test.ts` runs before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth. The payment section now matches #105.
- Do not merge draft pull request #103 after this report. It describes production as `78e01b6` and would overwrite this #105 note.
