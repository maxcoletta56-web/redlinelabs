# Redlinelabs Website Health

Last Updated: 9 October 2026

Overall Status: Production is serving pull request #111 (`71b6636`). GitHub Actions run `37865806810` passed lint, typecheck, and build. Vercel production deployment `6950037106` completed. Checkout can still insert an order, because that deploy ran the orders migration and `club_discount_cents` is part of it. Club join on the already-deployed build is not safe: Vercel skipped `scripts/ensure-club-tables.mjs`, and the running server does not add `member_code_hash` or drop the old `member_code` NOT NULL constraint. This environment cannot open a TLS connection to `https://redlinelabs.shop` or `*.vercel.app`, so the live pages were not opened. That TLS failure is not an outage. The storefront is still Redline Labs black and gold. PayID stays the default. PayPal stays the extra choice from pull request #105. Earning and redemption stay off until `CLUB_PROGRAM` is approved. Do not invent those rates.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart, checkout, and club conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

The copy of this file on the production branch was the 25 September scaffold. Draft pull request #109 records production at `1fb5bc3` and must not be merged after this report. Earlier health drafts (#106 and below) must not be merged either.

## Critical Issues

- Production `vercel.json` at `71b6636` omitted `scripts/ensure-club-tables.mjs`. `npm run build` and GitHub Actions ran it. Vercel did not, because `buildCommand` replaces the npm script. Pull request #107 created `club_members.member_code` as NOT NULL and stored the code in plaintext. Pull request #111 inserts only `member_code_hash` and needs `db/club.sql` to add that column and drop the NOT NULL constraint. `ensureClubTables` in `src/lib/club-db.ts` still only runs `CREATE TABLE IF NOT EXISTS` and the ledger index, so an existing table is left on the old shape. Once `CLUB_CODE_SECRET` is set, join calls that insert and a missing column or a NOT NULL violation returns HTTP 502, `Could not create the membership`. While the secret is unset, join returns HTTP 503 before it touches the table. This branch makes the Vercel command match `npm run build`. Do not merge it until `CLUB_CODE_SECRET` is set if any `member_code` values are still plaintext: the migration exits 1 in that case, Vercel keeps serving `71b6636`, and the schema change may already have been applied. A missing `DATABASE_URL` still skips the script and the build continues.

Checkout itself is not in that failure. `activeClubProgram()` is null, so the checkout page does not take a points discount. A club error during PayID checkout is logged and does not reject the order. The orders migration, which Vercel did run, adds `club_discount_cents`.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `RESEND_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, or `CLUB_CODE_SECRET` are set. If PayID or the database is missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. PayPal stays hidden until its two secrets are set. Admin club routes stay closed while `ADMIN_API_SECRET` is unset. That is unverified, not a second confirmed outage.

## High Priority Issues

- `/club` tells two stories. The page intro says points are earned on paid orders. The note under it says earn rates are not final and points are not earned or redeemed yet. `CLUB_PROGRAM.approved` is false, so the note is the one that matches the code. CRO should make the intro match. Do not turn earning on, and do not change the payment rail.
- `/club` is in the header and footer, including the mobile menu, and is not listed in `src/app/sitemap.ts`. `/club/balance` is `noindex`, which is appropriate for a member lookup. SEO should add `/club` to the sitemap. Do not rebuild the page.
- The public club steps still need to say that points, once redemption is approved, apply on PayID only. Checkout already hides the discount when PayPal is selected, and a club payload sent with PayPal is ignored.
- `reports/ecommerce-cro-health.md` still describes Stripe embedded checkout. It does not record bank transfer, PayPal, Remember me, continue-shopping, or Redline Club. The SEO, QA, security, and catalogue reports are still the 25 September scaffolds. Record those deploys in the owning reports. Do not implement the behaviour again.
- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026. `ProductImage` then shows `/brand/vial.png`. Detail belongs in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.

## Medium Priority Issues

- `GET /api/checkout` sets `paypalOffered` to `showChoice`. That is true only when both rails can run. A PayPal-only response has `defaultMethod: "paypal"` and `paypalOffered: false`. The cart and checkout pages read `showChoice` and `defaultMethod`. Nothing else reads the mismatched field. CRO can correct the field when it next touches that route.
- `ClubInviteModal` is mounted on every page and opens once per browser, after six seconds, on `/shop`, `/product`, and `/cart`. It does not open on `/checkout`, `/order`, or `/club`. Dismissal is stored in `localStorage` under `redline-club-invite-v1`. The invite copy was not rewritten in this pass.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. The club tests did not run in Actions run `37865806810`.
- Inter is a self-hosted variable font (`src/app/fonts/InterVariable.woff2`) via `next/font/local`. QA should confirm that file is the first paint face.
- `node_modules` is absent here and this environment cannot reach `registry.npmjs.org`, so this pass did not run `npm run check`. GitHub Actions remains the build evidence for `71b6636`. The build-command test was run locally with Node and does not need those packages.

## Low Priority Issues

- Unchecked Remember me still stores the account email in the client-readable cookie `rl_account_session`. The checked path, which is the default, keeps the sign-in in `localStorage` under `redline-session-v1`. Security owns that follow-up. Do not rebuild sign-in.
- Content-Security-Policy is still report-only. `form-action` allows `https://www.paypal.com` and `https://www.sandbox.paypal.com`.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.
- The test runner still warns that `package.json` has no `"type": "module"` when loading TypeScript tests.
- The cart drawer, cart page, and checkout still have one “Continue shopping” link each. Do not add another.

## Changes Made

- `vercel.json` `buildCommand` now runs `scripts/ensure-club-tables.mjs` after the orders migration and before `next build`, matching `package.json`.
- `src/lib/build-command.test.ts` fails if those two commands drift apart again.
- `reports/project-overview.md` now names bank transfer, PayPal beside PayID, Redline Club v1 (hashed codes, earning off until approved), `CLUB_CODE_SECRET`, `vercel.json`, and `VercelTelemetry`. The production copy had been left on the older PayPal-only wording.

No storefront layout, palette, catalogue data, or club rates were changed. Header and footer already link to `/club`.

Pull request #111 is already on the production branch. It reworks the club from pull request #107: hashed member codes, atomic ledger movements, PayID reserve/release, and an admin cancel route. `docs/redline-club.md` is the behaviour note. Do not build a second club.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).
- Filled cart, cart drawer, and checkout already link back to `/shop` (pull requests #88, #91, and #95).
- Account sign-in has Remember me, checked by default (pull request #97).
- PayPal guest card checkout replaced Stripe and Payoneer (pull request #102). Pull request #105 keeps that client and offers it beside PayID.
- Redline Club pages shipped in pull request #107. Pull request #111 replaces that accounting. Do not restore the plaintext member code or the invented earn rates.

## Tests Performed

- Reviewed `1fb5bc3..71b6636` (45 files). Club pages, checkout summary, orders insert, `db/club.sql`, and both build commands were included.
- Confirmed `package.json` `build` runs the club schema script and the production `vercel.json` did not.
- Confirmed `joinClub` hashes with `CLUB_CODE_SECRET` and then inserts `member_code_hash` only. A missing secret becomes HTTP 503. Any other database error becomes HTTP 502. The log line records the email domain and the error name, not the address or the code.
- Confirmed `ensureClubTables` in `src/lib/club-db.ts` does not apply the `ALTER TABLE` statements in `db/club.sql`.
- Confirmed `scripts/orders-migration.mjs` adds `club_discount_cents` when the orders table already exists, and that Vercel runs that script.
- Confirmed `activeClubProgram()` is null while `approved` is false, so checkout shows no club discount.
- Confirmed header and footer link to `/club`, and that `/club` is absent from `src/app/sitemap.ts`.
- `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test src/lib/build-command.test.ts`: 1 passed, 0 failed. Node also printed the existing warning that `package.json` has no `"type": "module"`.
- GitHub Actions run `37865806810` on `71b6636`: success (lint, typecheck, and build).
- GitHub deployment `6950037106` for `71b6636`: environment Production, state success, created 9 October 2026. Vercel status on that commit: Deployment has completed.
- `npm run check` was not run locally. `node_modules` is absent and this environment cannot reach `registry.npmjs.org`.
- The live site and the Vercel deployment URL were not opened. Checkout was not submitted. Club join was not submitted.

## Build Status

The production-branch build for `71b6636` succeeded in GitHub Actions, and Vercel reported production deployment `6950037106` complete. This health branch changes `vercel.json` and the reports. It should be reviewed as a Preview. It must not be promoted to production without an explicit request. Before that promotion, set `CLUB_CODE_SECRET` if any plaintext member codes remain, or the club migration will fail the build.

## Outstanding Work

- After this branch is merged, confirm the Vercel build log contains `club tables: club_members and club_points_ledger are in place` or `club tables: skipped (DATABASE_URL is not set)`. Do not print the database URL or the club secret.
- Confirm `CLUB_CODE_SECRET` is set in Vercel by name only. Join stays on HTTP 503 until it is.
- CRO: align the `/club` intro with the unpublished earn rates, and say points redeem on PayID only. Record pull request #111 in `ecommerce-cro-health.md`. Do not set `approved: true`.
- SEO: add `/club` to `src/app/sitemap.ts`. Leave `/club/balance` out of the index.
- Security: record hashed member codes, `CLUB_CODE_SECRET`, and the reconcile and cancel bearer routes. Leave secret values out of the repo and the reports.
- When egress allows, open `/`, `/shop`, `/club`, `/club/balance`, `/checkout`, and `/cart` and confirm they return 200. Do not submit a payment or a club join.
- Merge one current health report onto the production branch only when that merge is explicitly requested. Then close draft pull request #109 and the older health drafts so the next agent does not audit from the 25 September scaffold.
- Leave the black and gold storefront as it is. Do not apply a Metro Uniforms redesign.

## Recommendations

- Keep `vercel.json` `buildCommand` identical to the `package.json` `build` script. The build-command test is the guard. CI still does not run `npm test`, so a Vercel preview is the deploy check.
- Keep PayID as the default rail. Offer PayPal only when its secrets are set. Use `bank_transfer_only` to hide it.
- Keep one PayPal implementation in `src/lib/paypal.ts`, `src/lib/paypal-checkout.ts`, and `src/lib/checkout-session.ts`. Do not restore `payoneer.ts` or `stripe-keys.ts`.
- Keep club earning off until the rates in `docs/redline-club.md` are signed off in one change to `CLUB_PROGRAM`. Do not add a second points system.
- Keep one “Continue shopping” link on checkout, the cart page, and the cart drawer.
- Keep specialist agents on their own reports. The next CRO pass should record #111, not rebuild it.
- Add `npm test` to CI so the club tests run before a production deploy.
- Do not merge draft pull request #109 after this report. It describes production as `1fb5bc3` and would overwrite this note.
