# Redlinelabs Website Health

Last Updated: 19 October 2026

Overall Status: Production is serving `6b6246485acdd35ad3e6d953200ce9065a0bae53` (monthly VIP membership merged onto the club schema). GitHub marked that production deployment successful. The same SHA passed pull-request CI (lint, typecheck, and build). The production push workflow was cancelled before it ran any steps. The deployed `vercel.json` still skips the club schema script, so a paid membership can be stored without the member row being extended. This branch aligns the Vercel build with `npm run build`. The storefront remains Redline Labs black and gold.

## Critical Issues

- On production at `6b62464`, `vercel.json` `buildCommand` runs the comments and orders scripts and then `next build`. `package.json` also runs `scripts/ensure-club-tables.mjs`. Vercel uses `vercel.json`, so the deploy that is live now did not apply `db/club.sql`. Membership activation inserts `email`, `first_name`, and `member_code_hash` only. An existing `club_members.member_code` column that is still `NOT NULL` rejects that insert. Runtime `ensureClubTables` adds `membership_until` and `membership_cancel_at` and does not drop the `NOT NULL`. A failed activation is logged and does not undo the paid order, so the customer can pay $50 and stay inactive until the schema is applied.
- If any plaintext member codes remain and `CLUB_CODE_SECRET` is unset, `scripts/ensure-club-tables.mjs` exits 1. The next Vercel build would then fail and keep serving `6b62464`. Set the secret before merging this branch when those rows exist. A missing `DATABASE_URL` still skips the script and the build succeeds.
- Do not merge the older health pull requests (#112, #109, #106, #103, #100, #99, #94, #92, #89, #87, #84, #80, #76, #75, #69) after this one. #112 has the same build-command fix and a health report that stops at pull request #111, before monthly membership.

## High Priority Issues

- `docs/redline-club.md` still specified a points programme with earning and redemption off. The live offer is Redline VIP Membership: $50 a month (`MEMBERSHIP_PRICE_CENTS`), 30% off six products from `SPECIAL_POOL`, rotating on the 1st in Australia/Sydney, with no code. All twelve slugs are in `src/data/products.json`. Points redemption (`ClubRedeem`, `club-state`) is gone. A note at the top of that doc now says not to turn `CLUB_PROGRAM.approved` on and not to rebuild redemption. The README said the same outdated thing and now names the membership.
- Membership orders created from `/club` store a placeholder shipping address (`Membership — no delivery`, Sydney NSW 2000). `/order/[reference]` and the order email will show that address. The club form does this on purpose so a digital membership can use the existing address check. It is not the member's saved address.
- `reports/project-overview.md` on production still told every agent there was no `vercel.json` and that checkout was PayPal-only. That file now matches PayID, PayPal beside PayID, the schema build, `VercelTelemetry`, and monthly membership.
- Open Whop checkout pull requests are based on older branches. Merging one onto this membership checkout would need a fresh pass over `normalizeShipping`, member pricing, and the club schema. Do not merge them from this health check.

## Medium Priority Issues

- Push CI run `39207356691` for `6b62464` was cancelled with no steps (concurrency group `ci-${{ github.workflow }}-${{ github.ref }}`). Pull-request CI run `39207357544` for the same SHA passed lint, typecheck, and build in about 50 seconds. `npm test` is still absent from `.github/workflows/ci.yml`.
- Checkout previews member prices from `POST /api/club/status` using the email only. The amount charged is recomputed in `createCheckoutOrder` from the catalogue and `isActiveMember`. A lookup failure charges the regular total. The status response is only `{ active: true | false }`.
- Paying the same membership order twice does not add a second month. The ledger unique index on `(order_reference, reason)` makes the second `membership` insert a no-op.
- This environment cannot treat a TLS failure to `redlinelabs.shop` or `registry.npmjs.org` as a production outage. GitHub Actions can build.
- Sibling reports under `reports/` were last written for the 25 September Stripe-era pass. They are not a description of this deploy. Search, catalogue photos, headers, and performance budgets stay with those owners.

## Low Priority Issues

- The Vercel project lives under a team slug that contains "metrouniforms". That is hosting, not the storefront brand. Do not restyle the site to Metro Uniforms.
- `env.example` said PayPal was read only when `NEXT_PUBLIC_PAYMENTS_PROVIDER=paypal`. Unset, `bank_transfer`, and `paypal` all still offer PayPal when the secrets exist. The example comment now matches `paypalCheckoutOffered`.
- Account, cart, and policy pages were not re-walked in a browser on this pass. The membership diff did not change their chrome.

## Changes Made

- `vercel.json` `buildCommand` now matches `npm run build`, including `scripts/ensure-club-tables.mjs`.
- `src/lib/build-command.test.ts` fails if those two commands drift again.
- `docs/redline-club.md` and `README.md` name monthly membership and keep point earning off.
- `env.example` comments match the PayPal kill switch and the club schema script.
- `reports/project-overview.md` no longer claims a PayPal-only, zero-config deploy.
- No palette, layout, catalogue price, or earn-rate change.

## Tests Performed

- Inspection of `71b6636..6b62464` (24 files). Member-special slugs all exist in `src/data/products.json`. No remaining imports of `useClub`, `ClubRedeem`, or `club-state`.
- GitHub pull-request CI `39207357544` on `6b62464`: lint, typecheck, and build passed. The production push run was cancelled.
- GitHub production deployment `7166818554` for `6b62464`: state `success`. That success does not mean `db/club.sql` ran.
- Local `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test src/lib/build-command.test.ts src/lib/membership.test.ts`: 5 passed, 0 failed. `npm ci` could not finish in this environment (`registry.npmjs.org` closed the TLS handshake on `@neondatabase/serverless`), so `npm run lint`, `npm run typecheck`, `npm run build`, and the rest of `npm test` were not run here.

## Build Status

Pull-request CI for `6b62464` succeeded. Production deployment `7166818554` succeeded and is the build that skipped the club script. This branch has not been deployed. Do not merge it unless explicitly asked. A failed club migration (plaintext codes and no `CLUB_CODE_SECRET`) would leave production on `6b62464`.

## Outstanding Work

- Review this branch on a Vercel preview, then merge only when asked, so the next production build applies `db/club.sql`.
- Confirm `CLUB_CODE_SECRET` is set before that merge if plaintext member codes still exist.
- A green deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, PayPal, or Resend variables are set.
- Close or leave the older health pull requests unmerged so they cannot replace this report.
- Hand the placeholder membership address and the email-only status check to the checkout and security reports. Do not rebuild points.

## Recommendations

- Keep `vercel.json` and `package.json` `build` as one string. The new test is the guard.
- Leave `CLUB_PROGRAM.approved` false until earn rates are explicitly supplied.
- Add `npm test` to CI in a separate change. This pass does not, because the current gate is lint, typecheck, and build.
- Keep using preview deployments for storefront work. Production is `cursor/redlinelabs-shop-1c01`. There is no `main`.
