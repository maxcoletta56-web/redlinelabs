# Redlinelabs Website Health

Last Updated: 8 October 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `1fb5bc3` (merge of pull request #107, Redline Club). GitHub Actions run `37715064879` passed lint, typecheck, and build. Vercel production deployment `6925269304` completed successfully. This environment cannot open a TLS connection to `https://redlinelabs.shop` or `*.vercel.app`, so `/club` was reviewed in source and was not opened on the live site. That TLS failure is not an outage. The storefront is still Redline Labs black and gold. PayID stays the default. PayPal remains the extra choice from pull request #105. Club points redeem only on PayID.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart, checkout, and club conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

The copy of this file on the production branch was the 25 September scaffold. Draft pull request #106 recorded production at `efe984f` and was not merged. Do not merge #106, or any earlier health draft, after this report.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `RESEND_API_KEY`, `PAYPAL_CLIENT_ID`, or `PAYPAL_CLIENT_SECRET` are set. If PayID or the database is missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. PayPal stays hidden until its two secrets are set. Club join, balance, and redemption need `DATABASE_URL`. Admin club routes stay closed while `ADMIN_API_SECRET` is unset. That is unverified, not a confirmed production failure.

Deployment `6925269304` ran the orders migration, which adds `club_email` and `club_points_redeemed` when `DATABASE_URL` is set. The script did not refuse the build. If the database URL was unset, the script skips and a later insert would fail on those columns.

## High Priority Issues

- Production `vercel.json` at `1fb5bc3` omitted `scripts/ensure-club-tables.mjs`. `npm run build` and GitHub Actions ran it. Vercel did not, because `buildCommand` replaces the npm script. Club tables can still be created on the first request by `ensureClubTables` in `src/lib/club-db.ts`. This branch makes the Vercel command match `npm run build`, so the next deploy applies `db/club.sql` before `next build`. A failed apply exits the build. A missing `DATABASE_URL` still skips.
- `/club` is in the header and footer, including the mobile menu, and is not listed in `src/app/sitemap.ts`. `/club/balance` is `noindex`, which is appropriate for a member lookup. SEO should add `/club` to the sitemap. Do not rebuild the page.
- The public `/club` steps say points are spent at checkout. Checkout hides redemption when PayPal is selected, and a club payload sent with PayPal is ignored. CRO should say that points apply on PayID only. Do not change the payment rail.
- `reports/ecommerce-cro-health.md` still describes Stripe embedded checkout. It does not record bank transfer, PayPal, Remember me, continue-shopping, or Redline Club. The SEO, QA, security, and catalogue reports are still the 25 September scaffolds. Record those deploys in the owning reports. Do not implement the behaviour again.
- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026. `ProductImage` then shows `/brand/vial.png`. Detail belongs in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.

## Medium Priority Issues

- `GET /api/checkout` sets `paypalOffered` to `showChoice`. That is true only when both rails can run. A PayPal-only response has `defaultMethod: "paypal"` and `paypalOffered: false`. The cart and checkout pages read `showChoice` and `defaultMethod`. Nothing else reads the mismatched field. CRO can correct the field when it next touches that route.
- `ClubInviteModal` is mounted on every page and opens once per browser, after six seconds, on `/shop`, `/product`, and `/cart`. It does not open on `/checkout`, `/order`, or `/club`. Dismissal is stored in `localStorage` under `redline-club-invite-v1`.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. The club and PayPal checkout tests did not run in Actions run `37715064879`.
- Inter is a self-hosted variable font (`src/app/fonts/InterVariable.woff2`, about 352 KB) via `next/font/local`. QA should confirm that file is the first paint face.
- `node_modules` is absent here and this environment cannot reach `registry.npmjs.org`, so this pass did not run `npm run check`. GitHub Actions remains the build evidence for `1fb5bc3`. The new build-command test was run locally with Node and does not need those packages.

## Low Priority Issues

- Unchecked Remember me still stores the account email in the client-readable cookie `rl_account_session`. The checked path, which is the default, keeps the sign-in in `localStorage` under `redline-session-v1`. Security owns that follow-up. Do not rebuild sign-in.
- Content-Security-Policy is still report-only. `form-action` allows `https://www.paypal.com` and `https://www.sandbox.paypal.com`.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.
- The test runner still warns that `package.json` has no `"type": "module"` when loading TypeScript tests.
- The cart drawer, cart page, and checkout still have one “Continue shopping” link each. Do not add another.

## Changes Made

- `vercel.json` `buildCommand` now runs `scripts/ensure-club-tables.mjs` after the orders migration and before `next build`, matching `package.json`.
- `src/lib/build-command.test.ts` fails if those two commands drift apart again.
- `reports/project-overview.md` now names bank transfer, PayPal beside PayID, Redline Club, `vercel.json`, and `VercelTelemetry`. The production copy had been left on the older PayPal-only wording.

No storefront layout, palette, or catalogue data was changed. Header and footer already link to `/club`. `ClubProvider` and `ClubInviteModal` are already in `Providers`.

Pull request #107 is already on the production branch. It adds `/club`, `/club/balance`, join and quote routes, admin member routes, and points on paid orders. A club failure at checkout does not block the order. A second PayPal capture does not award points again.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).
- Filled cart, cart drawer, and checkout already link back to `/shop` (pull requests #88, #91, and #95).
- Account sign-in has Remember me, checked by default (pull request #97).
- PayPal guest card checkout replaced Stripe and Payoneer (pull request #102). Pull request #105 keeps that client and offers it beside PayID.

## Tests Performed

- Reviewed `efe984f..1fb5bc3` (41 files). Club pages, header, footer, checkout, and the orders insert were included. `vercel.json` was not.
- Confirmed `package.json` `build` runs the club schema script and the production `vercel.json` did not.
- Confirmed `ensureClubTables` in `src/lib/club-db.ts` still creates `club_members`, `club_points_ledger`, and the unique ledger index on first use.
- Confirmed a club hold failure is logged and does not reject the order, and that marking an order paid still succeeds when awarding points throws.
- Confirmed header and footer, including the mobile nav, link to `/club`, and that `/club` links to `/club/balance`.
- Confirmed `/club` is absent from `src/app/sitemap.ts` and that `/club/balance` sets `index: false`.
- Confirmed the cart drawer “Continue shopping” link still goes to `/shop` and only closes the drawer.
- `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test src/lib/build-command.test.ts`: 1 passed, 0 failed. Node also printed the existing warning that `package.json` has no `"type": "module"`.
- GitHub Actions run `37715064879` on `1fb5bc3`: success (lint, typecheck, and build).
- GitHub deployment `6925269304` for `1fb5bc3`: environment Production, state success, created 8 October 2026.
- `npm run check` was not run locally. `node_modules` is absent and this environment cannot reach `registry.npmjs.org`.
- The live site and the Vercel deployment URL were not opened. Checkout was not submitted. Club join was not submitted.

## Build Status

The production-branch build for `1fb5bc3` succeeded in GitHub Actions, and Vercel reported production deployment `6925269304` complete. This health branch changes `vercel.json` and the reports. It should be reviewed as a Preview. It must not be promoted to production without an explicit request.

## Outstanding Work

- After this branch is merged, confirm the Vercel build log contains `club tables: club_members and club_points_ledger are in place` or `club tables: skipped (DATABASE_URL is not set)`. Do not print the database URL.
- SEO: add `/club` to `src/app/sitemap.ts`. Leave `/club/balance` out of the index.
- CRO: record pull request #107 in `ecommerce-cro-health.md`, and say on `/club` that points redeem on PayID only. Do not add another payment client, and do not change `NEXT_PUBLIC_PAYMENTS_PROVIDER` unless that change is explicitly requested.
- Security: record the admin club routes under `ADMIN_API_SECRET`, and that the member code is not stored in `localStorage`. Leave secret values out of the repo and this report.
- When egress allows, open `/`, `/shop`, `/club`, `/club/balance`, `/checkout`, and `/cart` and confirm they return 200. Do not submit a payment or a club join.
- Confirm PayID, database, and Resend variables exist in Vercel by name only. Confirm `orders` has `club_email` and `club_points_redeemed`.
- Merge one current health report onto the production branch only when that merge is explicitly requested. Then close the older health drafts (#106 and earlier) so the next agent does not audit from the 25 September scaffold.
- Leave the black and gold storefront as it is. Do not apply a Metro Uniforms redesign.

## Recommendations

- Keep `vercel.json` `buildCommand` identical to the `package.json` `build` script. The build-command test is the guard. CI still does not run `npm test`, so a Vercel preview is the deploy check.
- Keep PayID as the default rail. Offer PayPal only when its secrets are set. Use `bank_transfer_only` to hide it.
- Keep one PayPal implementation in `src/lib/paypal.ts`, `src/lib/paypal-checkout.ts`, and `src/lib/checkout-session.ts`. Do not restore `payoneer.ts` or `stripe-keys.ts`.
- Keep club points on the PayID path only. Do not send a redemption to PayPal.
- Keep one “Continue shopping” link on checkout, the cart page, and the cart drawer.
- Keep specialist agents on their own reports. The next CRO pass should record #107, not rebuild it.
- Add `npm test` to CI so the club tests run before a production deploy.
- Do not merge draft pull request #106 after this report. It describes production as `efe984f` and would overwrite this note.
