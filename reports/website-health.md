# Redlinelabs Website Health

Last Updated: 19 October 2026

Overall Status: Production is serving `afe4e5dc10aedd9b9fff518a6449b37bc622ec61` (Join the club as a large centered popup). GitHub CI run `39212941778` passed lint, typecheck, and build. Production deployment `7167628349` succeeded. That deploy still uses a `vercel.json` build that skips `scripts/ensure-club-tables.mjs`, so a paid membership can be stored without the member row being extended. The storefront remains Redline Labs black and gold. This environment cannot open `https://redlinelabs.shop` (TLS closed during the handshake); that failure is not treated as an outage.

## Critical Issues

- On production at `afe4e5d`, `vercel.json` `buildCommand` runs the comments and orders scripts and then `next build`. `package.json` also runs `scripts/ensure-club-tables.mjs`. Vercel uses `vercel.json`, so this deploy did not apply `db/club.sql`. Membership activation inserts `email`, `first_name`, and `member_code_hash` only. An existing `club_members.member_code` column that is still `NOT NULL` rejects that insert. Runtime `ensureClubTables` adds `membership_until` and `membership_cancel_at` and does not drop the `NOT NULL`. A failed activation is logged and does not undo the paid order, so the customer can pay $50 and stay inactive until the schema is applied. Draft pull request #115 already contains the build-command alignment and `src/lib/build-command.test.ts`. This pass does not copy that change.
- If any plaintext member codes remain and `CLUB_CODE_SECRET` is unset, `scripts/ensure-club-tables.mjs` exits 1. The next Vercel build would then fail and keep serving `afe4e5d`. Set the secret before merging #115 when those rows exist. A missing `DATABASE_URL` still skips the script and the build succeeds.
- Do not merge the older health pull requests (#117, #112, #109, #106, #103, #100, #99, #94, #92, #89, #87, #84, #80, #76, #75, #69) after this one. #117 closes the banner and its report stops at `60c51ca`, before the popup; its CI run `39210747975` failed at lint. #115's report stops at `6b62464`. If #115 is merged for the schema fix, keep this report.

## High Priority Issues

- The Join the club popup is mounted once in `Providers`. On `afe4e5d` it stayed open, with body scroll locked, after a client navigation from home, the catalogue, a product, or the cart onto `/checkout`, `/order/[reference]`, or `/club`. The cart drawer is `z-50` and the popup is `z-[45]`, so Checkout in the drawer can start that navigation while the dialog is open. `shouldKeepInviteOpen` now hides the dialog when the path is no longer eligible. Dismissal still uses `localStorage` key `redline-club-invite-v3` and is the only thing that suppresses a later visit. Returning to an invited route in the same session shows it again, because leaving is not a dismissal.
- `docs/redline-club.md` and `README.md` on production still describe a points programme. The live offer is Redline VIP Membership: $50 a month (`MEMBERSHIP_PRICE_CENTS` 5000), 30% off six products from `SPECIAL_POOL`, rotating on the 1st in Australia/Sydney, with no code. Points redemption (`ClubRedeem`, `club-state`) is gone. #115 updates those docs. Do not turn `CLUB_PROGRAM.approved` on and do not rebuild redemption.
- Membership orders created from `/club` store a placeholder shipping address (`Membership — no delivery`, Sydney NSW 2000). `/order/[reference]` and the order email show that address. The club form does this so a digital membership can use the existing address check.
- `reports/project-overview.md` on production still says there is no `vercel.json` and that checkout is PayPal-only. #115 corrects that file. This pass leaves it so the two edits do not diverge.
- Open Whop checkout pull requests are based on older branches. Merging one onto this membership checkout would need a fresh pass over `normalizeShipping`, member pricing, and the club schema. Do not merge them from this health check.

## Medium Priority Issues

- The popup uses `role="dialog"` and `aria-modal="true"`, moves focus to Close, and locks scroll, but it does not trap Tab. The cart drawer remains above it, so the drawer can be used while the dialog is open on an invited route. Escape, the overlay, Close, and No thanks dismiss it. The previous membership modal printed `RESEARCH_DISCLAIMER`; this popup does not. Checkout still requires age and research-use confirmation before an order is created. Hand the disclaimer question to the compliance report.
- The popup waits 1.5 seconds and uses dismissal key `redline-club-invite-v3`, so a browser that closed the bottom banner (`redline-club-invite-v2`) sees this popup once. That matches `afe4e5d`.
- Push CI run `39207356691` for `6b62464` was cancelled with no steps. Later push CI for `60c51ca` (`39210123815`) and `afe4e5d` (`39212941778`) passed. `npm test` is still absent from `.github/workflows/ci.yml`.
- Checkout previews member prices from `POST /api/club/status` using the email only. The amount charged is recomputed in `createCheckoutOrder` from the catalogue and `isActiveMember`. A lookup failure charges the regular total. The status response is only `{ active: true | false }`.
- Paying the same membership order twice does not add a second month. The ledger unique index on `(order_reference, reason)` makes the second `membership` insert a no-op.
- This environment cannot treat a TLS failure to `redlinelabs.shop`, `*.vercel.app`, or `registry.npmjs.org` as a production outage. GitHub Actions can build. `node_modules` is absent here.
- Sibling reports under `reports/` were last written for the 25 September Stripe-era pass. They are not a description of this deploy. Search, catalogue photos, headers, and performance budgets stay with those owners.

## Low Priority Issues

- The Vercel project lives under a team slug that contains "metrouniforms". That is hosting, not the storefront brand. Do not restyle the site to Metro Uniforms.
- `node --test` warns that `package.json` has no `"type": "module"`. Leave that for a separate change.
- On a phone the popup anchors to the bottom of the viewport (`items-end`) and scrolls inside `max-h-[calc(100dvh-1.5rem)]`. Desktop centers it. This pass does not change that layout.
- Account, cart, and policy pages were not walked in a browser on this pass. The dev server was not started.

## Changes Made

- `shouldKeepInviteOpen` hides the Join the club popup when the customer leaves an invited route, including a client navigation onto checkout, an order, or `/club`. The dialog unmounts and the scroll lock is released. The popup visual treatment shipped in `afe4e5d` is unchanged.
- `src/lib/club-invite.test.ts` covers that close rule.
- This report replaces the 25 September Stripe-era status that was still on the production branch, and it supersedes the banner report on pull request #117.
- No palette, catalogue price, or earn-rate change.

## Tests Performed

- Inspection of `60c51ca..afe4e5d` (popup CSS and `ClubInviteModal`) and of `Providers` plus `CartDrawer`. `/` is an exact match. Checkout, `/order`, and `/club` are excluded by `shouldInviteOnPath`. The drawer Checkout control is a client `Link` inside `z-50`.
- Local `node --experimental-strip-types --test src/lib/club-invite.test.ts`: 3 passed, 0 failed. `node --test` still warns that `package.json` has no `"type": "module"`.
- GitHub CI `39212941778` on `afe4e5d`: lint, typecheck, and build passed.
- GitHub production deployment `7167628349` for `afe4e5d`: Vercel reported the deployment complete. That success does not mean `db/club.sql` ran.
- `npm ci` was not run. `registry.npmjs.org` is blocked from this environment, and `node_modules` is not present, so `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run check` were not run here.

## Build Status

Push CI for `afe4e5d` succeeded. Production deployment `7167628349` succeeded and is the build that skipped the club script. This branch has not been deployed. Do not merge it unless explicitly asked. Merging #115 afterwards still needs `CLUB_CODE_SECRET` when plaintext member codes remain, or the build fails and Vercel keeps `afe4e5d`.

## Outstanding Work

- Merge pull request #115 only when asked, so the next production build applies `db/club.sql`. Keep this health report if the two reports conflict.
- Confirm `CLUB_CODE_SECRET` is set before that merge if plaintext member codes still exist.
- Leave pull request #117 unmerged. It targets the banner at `60c51ca`, its lint failed, and merging it can fight the popup in `afe4e5d`.
- A green deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, PayPal, or Resend variables are set.
- Close or leave the older health pull requests unmerged so they cannot replace this report.
- Hand the placeholder membership address and the email-only status check to the checkout and security reports. Do not rebuild points.

## Recommendations

- Keep one build command in `vercel.json` and `package.json`. The test on #115 is the guard. Do not add a second copy of that test here.
- Leave `CLUB_PROGRAM.approved` false until earn rates are explicitly supplied.
- Add `npm test` to CI in a separate change. The current gate is lint, typecheck, and build, which does not run `club-invite.test.ts`.
- Keep using preview deployments for storefront work. Production is `cursor/redlinelabs-shop-1c01`. There is no `main`.
