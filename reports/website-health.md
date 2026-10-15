# Redlinelabs Website Health

Last Updated: 6 October 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `78e01b6` (merge of pull request #102, PayPal guest card checkout in place of Stripe and Payoneer). GitHub Actions run `37481117402` passed lint, typecheck, and build. Vercel production deployment `6887020012` completed successfully. This environment cannot open a TLS connection to `https://redlinelabs.shop`, `*.vercel.app`, or the npm registry, so the new checkout was reviewed in source. It was not clicked on the live site. That TLS failure is not an outage. No render or build break was found in the push. The storefront is still Redline Labs black and gold. The default checkout rail is still bank transfer. PayPal runs only when `NEXT_PUBLIC_PAYMENTS_PROVIDER=paypal` was present at build time.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

The copy of this file that was on the production branch was the 25 September scaffold. Draft pull request #100 recorded production at `537546d` and was not merged. Read this report until one health pull request is merged.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `RESEND_API_KEY`, `PAYPAL_CLIENT_ID`, or `PAYPAL_CLIENT_SECRET` are set. If the PayID or database values are missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. PayPal credentials are unused while the public provider flag is `bank_transfer`. That is unverified, not a confirmed production failure.

## High Priority Issues

- Pull request #102 removed `src/lib/payoneer.ts` and `src/lib/stripe-keys.ts` and added PayPal as the card rail. `parsePaymentsProvider` maps `stripe`, `payoneer`, and any other unknown value to `bank_transfer`. Card checkout does not start unless the inlined flag is exactly `paypal`. Do not flip `NEXT_PUBLIC_PAYMENTS_PROVIDER` from this health pass. CRO owns the decision to select the card rail. A production value left over from Stripe or Payoneer now checks out as bank transfer.
- Unchecked Remember me stores the account email in the client-readable cookie `rl_account_session` (`Path=/`, `SameSite=Lax`, `Secure` on https, no `Max-Age`). The checked path, which is the default, keeps the sign-in in `localStorage` under `redline-session-v1` and clears the cookie. Accounts remain browser-local. This is a privacy regression on the opt-out path from pull request #97, not a confirmed breach. Security owns the follow-up. Do not rebuild sign-in.
- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026. `ProductImage` then shows `/brand/vial.png`. Detail belongs in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/ecommerce-cro-health.md` still describes Stripe embedded checkout and a 26 September Payoneer note. It does not record bank transfer, PayPal, the continue-shopping links, or Remember me. `reports/seo-aeo-health.md`, `reports/qa-performance-health.md`, `reports/security-compliance-health.md`, and `reports/catalogue-merchandising-health.md` are still the 25 September scaffolds. Pull request #86 belongs in the SEO report. Pull requests #88, #91, and #95 belong in the CRO report. Pull request #82 belongs in the CRO report as the shared mark-paid receipt, and in the security report only for the admin auth boundary. Pull request #97 belongs in the security report for the session cookie. Pull request #102 belongs in the CRO report as the PayPal card rail, and in the security report for credential handling. None of those behaviours should be implemented again.

## Medium Priority Issues

- `/checkout/success` confirms a PayPal capture from the httpOnly cookie `rl_paypal_checkout` (30 minutes, path `/`). The cookie holds the checkout receipt, including email and shipping. Bank-transfer buyers are sent to `/order/[reference]` instead. If that cookie is missing, the success page says PayPal could not confirm the payment. Security should review the cookie. CRO should record the return path. Do not point bank-transfer orders at `/checkout/success`.
- If `rl_account_session` names an email that is not in the browser account list, startup in `src/lib/account.tsx` clears both the cookie and `redline-session-v1`. A cookie wins over a remembered login, so an orphan cookie also drops a still-valid remembered sign-in. Security should decide whether an unknown cookie should be ignored instead of wiping the other store.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. `src/lib/paypal.test.ts` (7 tests) did not run in Actions run `37481117402`.
- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. QA should confirm the largest paint did not move to a late image.
- `reports/project-overview.md` on `78e01b6` said there was no `vercel.json`, that checkout was PayPal-only, and that analytics were absent. This pass corrects those three facts. Specialist agents should read the corrected overview before editing checkout.

## Low Priority Issues

- Content-Security-Policy is still report-only. `form-action` allows `https://www.paypal.com` and `https://www.sandbox.paypal.com`. `connect-src` and `frame-src` do not list PayPal. Card checkout redirects the browser to PayPal from the server approval URL, so those two directives are not on the redirect path. Leave the header report-only.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.
- The test runner still warns that `package.json` has no `"type": "module"` when loading TypeScript tests.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Creating an account always sets `rememberSession` to true and does not show the checkbox. The checkout Continue shopping link uses `mt-4`. The cart page and cart drawer use `mt-3` on the same `btn-ghost w-full` treatment.

## Changes Made

No storefront code was changed in this health pass. Pull request #102 is already on the production branch.

PayPal replaces Stripe and Payoneer as the card rail. `src/lib/payoneer.ts`, `src/lib/stripe-keys.ts`, and their tests are gone. `src/lib/paypal.ts` and `src/lib/checkout-session.ts` create an Orders v2 order and return the guest approval URL. Capture runs in `loadPaypalReceipt` when the buyer comes back to `/checkout/success`. `stripeCouponParams` was removed from `src/lib/promo-pricing.ts`. The DGC20 percent-off helper remains. Browser store credit is still not sent to either rail. Header, gold and black palette, and catalogue data were not part of the #102 diff.

`reports/project-overview.md` again names bank transfer as the default rail, `vercel.json` as the build command, and `VercelTelemetry` as the analytics scripts. The #102 edit of that file had replaced those facts with a PayPal-only description.

Remember me from pull request #97 is unchanged. The filled-cart continue-shopping links from pull requests #88, #91, and #95 are unchanged. Do not add another. The admin receipt path from pull request #82 is unchanged: the desk and `POST /api/admin/orders/[reference]/paid` share `markOrderPaidWithPaymentEmail`. There is no `src/lib/record-admin-payment.ts` on `78e01b6`.

This report supersedes the 5 October write-up on draft pull request #100, which stopped at `537546d`.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).
- Filled cart, cart drawer, and checkout already link back to `/shop` (pull requests #88, #91, and #95).
- Account sign-in has Remember me, checked by default (pull request #97).

## Tests Performed

- Reviewed `537546d..78e01b6` (35 files). Deleted Payoneer and Stripe key modules. Added `src/lib/paypal.ts` and `src/lib/paypal.test.ts`. Checkout API, checkout page, success page, and `payments-provider.ts` now branch on `bank_transfer` or `paypal`.
- Confirmed `DEFAULT_PAYMENTS_PROVIDER` is `bank_transfer`, and that `stripe` and `payoneer` parse to that default.
- Confirmed `POST /api/checkout` checks `bankTransferConfigured()` or `paypalConfigured()` for the selected rail and returns 503 for that rail only.
- Confirmed bank transfer still returns `redirectUrl: /order/{reference}`.
- Confirmed no remaining imports of `payoneer` or `stripe-keys`. `promo-pricing.ts` still exports `checkoutTotals`, which the cart and checkout pages import.
- `node --experimental-strip-types --test src/lib/payments-provider.test.ts src/lib/paypal.test.ts`: 10 passed, 0 failed. The runner warned that `package.json` has no `"type": "module"`.
- GitHub Actions run `37481117402` on `78e01b6`: success (lint, typecheck, and build).
- GitHub deployment `6887020012` for `78e01b6`: environment Production, state success, created 6 October 2026.
- `npm run check` was not run locally. `node_modules` is absent and this environment cannot reach `registry.npmjs.org`. GitHub Actions remains the build evidence for `78e01b6`.
- The live site and the Vercel deployment URL were not opened. Checkout was not submitted.

## Build Status

The production-branch build for `78e01b6` succeeded in GitHub Actions, and Vercel reported production deployment `6887020012` complete. This health branch updates the report and the project overview. It should not be promoted ahead of an explicit request, and it does not need a separate production deploy.

## Outstanding Work

- CRO: record pull request #102 in `ecommerce-cro-health.md`. The card rail already exists. Do not add a second PayPal client, and do not set `NEXT_PUBLIC_PAYMENTS_PROVIDER` unless that change is explicitly requested.
- Security: record PayPal credential handling, the `rl_paypal_checkout` receipt cookie, and the Remember me cookie. Leave `ADMIN_API_SECRET`, PayID values, PayPal secrets, and `RESEND_API_KEY` out of the repo and this report.
- When egress allows, open `/checkout` and confirm the copy matches the built provider. With the default flag, the page should describe bank transfer or PayID. Do not submit a card payment.
- When egress allows, open `/account` on desktop and at 390px and re-check Remember me. The steps are in the 5 October note: checked sign-in survives reload, unchecked sign-in uses a session cookie with no `Max-Age`, and sign-out clears both stores.
- Confirm PayID, database, Resend, and, only if the flag is `paypal`, PayPal variables exist in Vercel by name only.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Merge one current health report onto the production branch only when that merge is explicitly requested. Then close the older health drafts (#100, #99, #94, and earlier) so the next agent does not audit from the 25 September scaffold.
- Leave the black and gold storefront as it is. Do not apply a Metro Uniforms redesign.

## Recommendations

- Keep bank transfer as the default rail until a requested change sets `NEXT_PUBLIC_PAYMENTS_PROVIDER=paypal` for a production build. Do not infer the card rail from the presence of `src/lib/paypal.ts`.
- Keep a single PayPal implementation in `src/lib/paypal.ts` and `src/lib/checkout-session.ts`. Do not restore `payoneer.ts` or `stripe-keys.ts`.
- Keep the mark-paid receipt on `markOrderPaidWithPaymentEmail`. Do not add `record-admin-payment.ts` back, and do not merge pull request #80’s copy of that path.
- Keep a single “Continue shopping” link on checkout, the cart page, and the cart drawer.
- Keep specialist agents on their own reports. Another pass should record #102, not rebuild it.
- Add `npm test` to CI so `src/lib/paypal.test.ts` runs before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
- Do not merge draft pull request #100 after this report. It describes production as `537546d` and would overwrite this #102 note.
