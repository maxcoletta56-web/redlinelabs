# Redlinelabs Website Health

Last Updated: 19 October 2026

Overall Status: Production is serving `60c51cab72a220d60d2c71c3a123cad14b67ade3` (Join the club banner on the home page and catalogue). GitHub CI run `39210123815` passed lint, typecheck, and build. Production deployment `7167216455` succeeded. That deploy still uses a `vercel.json` build that skips `scripts/ensure-club-tables.mjs`, so a paid membership can be stored without the member row being extended. The storefront remains Redline Labs black and gold. This environment cannot open `https://redlinelabs.shop` (TLS closed during the handshake); that failure is not treated as an outage.

## Critical Issues

- On production at `60c51ca`, `vercel.json` `buildCommand` runs the comments and orders scripts and then `next build`. `package.json` also runs `scripts/ensure-club-tables.mjs`. Vercel uses `vercel.json`, so this deploy did not apply `db/club.sql`. Membership activation inserts `email`, `first_name`, and `member_code_hash` only. An existing `club_members.member_code` column that is still `NOT NULL` rejects that insert. Runtime `ensureClubTables` adds `membership_until` and `membership_cancel_at` and does not drop the `NOT NULL`. A failed activation is logged and does not undo the paid order, so the customer can pay $50 and stay inactive until the schema is applied. Draft pull request #115 already contains the build-command alignment and `src/lib/build-command.test.ts`. This pass does not copy that change.
- If any plaintext member codes remain and `CLUB_CODE_SECRET` is unset, `scripts/ensure-club-tables.mjs` exits 1. The next Vercel build would then fail and keep serving `60c51ca`. Set the secret before merging #115 when those rows exist. A missing `DATABASE_URL` still skips the script and the build succeeds.
- Do not merge the older health pull requests (#112, #109, #106, #103, #100, #99, #94, #92, #89, #87, #84, #80, #76, #75, #69) after this one. #112 stops at pull request #111, before monthly membership. #115's report stops at `6b62464`, before the banner. If #115 is merged for the schema fix, keep this report.

## High Priority Issues

- The Join the club banner is mounted once in `Providers` and previously stayed open after a client navigation from home, the catalogue, a product, or the cart onto `/checkout`, `/order/[reference]`, or `/club`. The path helper already excluded those routes, and the unit test only covered the helper, so the open banner could still sit over checkout. `shouldKeepInviteOpen` now closes it when the path is no longer eligible. Dismissal still uses `localStorage` key `redline-club-invite-v2` and is the only thing that suppresses a later visit.
- On an invited route the banner is `position: fixed` at the bottom, `z-[45]`, full width on a phone, with no page padding. The cart page "Continue to checkout" control and an in-flow "Add to cart" can sit underneath it until the customer dismisses it. The cart drawer is `z-50`, so the drawer checkout control stays above the banner. Header is `z-40`. Hand the overlap to the conversion report. This pass does not restyle the banner.
- `docs/redline-club.md` and `README.md` on production still describe a points programme. The live offer is Redline VIP Membership: $50 a month (`MEMBERSHIP_PRICE_CENTS` 5000), 30% off six products from `SPECIAL_POOL`, rotating on the 1st in Australia/Sydney, with no code. Points redemption (`ClubRedeem`, `club-state`) is gone. #115 updates those docs. Do not turn `CLUB_PROGRAM.approved` on and do not rebuild redemption.
- Membership orders created from `/club` store a placeholder shipping address (`Membership — no delivery`, Sydney NSW 2000). `/order/[reference]` and the order email show that address. The club form does this so a digital membership can use the existing address check.
- `reports/project-overview.md` on production still says there is no `vercel.json` and that checkout is PayPal-only. #115 corrects that file. This pass leaves it so the two edits do not diverge.
- Open Whop checkout pull requests are based on older branches. Merging one onto this membership checkout would need a fresh pass over `normalizeShipping`, member pricing, and the club schema. Do not merge them from this health check.

## Medium Priority Issues

- The banner uses `role="dialog"` with `aria-modal="false"` and does not move focus, so a screen reader may not announce it. Escape still dismisses it. The previous modal printed `RESEARCH_DISCLAIMER`; the banner does not. Checkout still requires age and research-use confirmation before an order is created. Hand the disclaimer question to the compliance report.
- The banner waits 1.5 seconds (previously 6) and uses a new dismissal key, so a browser that closed the old invite sees this one once. That matches the commit.
- Push CI run `39207356691` for `6b62464` was cancelled with no steps. The later push CI run `39210123815` for `60c51ca` passed. `npm test` is still absent from `.github/workflows/ci.yml`.
- Checkout previews member prices from `POST /api/club/status` using the email only. The amount charged is recomputed in `createCheckoutOrder` from the catalogue and `isActiveMember`. A lookup failure charges the regular total. The status response is only `{ active: true | false }`.
- Paying the same membership order twice does not add a second month. The ledger unique index on `(order_reference, reason)` makes the second `membership` insert a no-op.
- This environment cannot treat a TLS failure to `redlinelabs.shop`, `*.vercel.app`, or `registry.npmjs.org` as a production outage. GitHub Actions can build. A probe on 19 October 2026 failed with `UNEXPECTED_EOF_WHILE_READING` for both the shop and the production deployment host.
- Sibling reports under `reports/` were last written for the 25 September Stripe-era pass. They are not a description of this deploy. Search, catalogue photos, headers, and performance budgets stay with those owners.

## Low Priority Issues

- The Vercel project lives under a team slug that contains "metrouniforms". That is hosting, not the storefront brand. Do not restyle the site to Metro Uniforms.
- `node --test` warns that `package.json` has no `"type": "module"`. Leave that for a separate change.
- Account, cart, and policy pages were not walked in a browser on this pass. `node_modules` is absent here, so the dev server was not started.

## Changes Made

- `shouldKeepInviteOpen` closes the Join the club banner when the customer leaves an invited route, including a client navigation onto checkout, an order, or `/club`.
- `src/lib/club-invite.test.ts` covers that close rule.
- This report replaces the 25 September Stripe-era status that was still on the production branch.
- No palette, layout, catalogue price, or earn-rate change. The banner visual treatment shipped in `60c51ca` is unchanged.

## Tests Performed

- Inspection of `6b62464..60c51ca` (banner CSS, `ClubInviteModal`, invite routes). `/` is an exact match so it does not invite every path. Checkout, `/order`, and `/club` are excluded by `shouldInviteOnPath`.
- Local `node --experimental-strip-types --test src/lib/club-invite.test.ts`: 3 passed, 0 failed.
- GitHub CI `39210123815` on `60c51ca`: lint, typecheck, and build passed.
- GitHub production deployment `7167216455` and preview deployment `7167216566` for `60c51ca`: state `success`. That success does not mean `db/club.sql` ran.
- `npm ci` was not run. `registry.npmjs.org` is blocked from this environment, and `node_modules` is not present, so `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run check` were not run here.

## Build Status

Push CI for `60c51ca` succeeded. Production deployment `7167216455` succeeded and is the build that skipped the club script. This branch has not been deployed. Do not merge it unless explicitly asked. Merging #115 afterwards still needs `CLUB_CODE_SECRET` when plaintext member codes remain, or the build fails and Vercel keeps `60c51ca`.

## Outstanding Work

- Merge pull request #115 only when asked, so the next production build applies `db/club.sql`. Keep this health report if the two reports conflict.
- Confirm `CLUB_CODE_SECRET` is set before that merge if plaintext member codes still exist.
- A green deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, PayPal, or Resend variables are set.
- Give the cart and product overlap of the bottom banner to the conversion agent. Do not add a second banner.
- Close or leave the older health pull requests unmerged so they cannot replace this report.
- Hand the placeholder membership address and the email-only status check to the checkout and security reports. Do not rebuild points.

## Recommendations

- Keep one build command in `vercel.json` and `package.json`. The test on #115 is the guard. Do not add a second copy of that test here.
- Leave `CLUB_PROGRAM.approved` false until earn rates are explicitly supplied.
- Add `npm test` to CI in a separate change. The current gate is lint, typecheck, and build, which does not run `club-invite.test.ts`.
- Keep using preview deployments for storefront work. Production is `cursor/redlinelabs-shop-1c01`. There is no `main`.
