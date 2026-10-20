# Redlinelabs Website Health

Last Updated: 20 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `7f2cafe`. That commit replaces the monthly VIP price with a one-time $15 Redline Club sign-up. Bronze, Silver, Gold and Platinum start at $500, $1,000, $1,500 and $2,000 of lifetime spend. Paid orders earn 1 point per dollar, and points do not reduce checkout. GitHub CI run `39358730384` passed, and GitHub recorded production deployment `7189915695` as successful. This environment cannot open TLS to `redlinelabs.shop`, `*.vercel.app`, or `registry.npmjs.org`, so the live pages and `npm run check` were not run here.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set.

## High Priority Issues

- On `7f2cafe` the join popup stays mounted in `Providers`. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The dialog then keeps `document.body` scroll-locked. Opening depends on `shouldInviteOnPath`, which does not hide an already-open dialog. This branch hides it with `shouldKeepInviteOpen` during render and releases the lock. Draft PR #119 has the same close on the older monthly-discount copy. Do not merge #119 over this branch.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs`. Production therefore skips the club schema script. Runtime `ensureClubTables` creates a missing table and adds the membership columns. It does not hash legacy plaintext member codes, and it does not drop `NOT NULL` on `member_code`. A paid $15 order can be stored while activation fails. Draft PR #115 already edits `vercel.json`. Do not open a second copy, and do not merge #115 unless asked. That branch also rewrites the invite and an older health report.
- Club activation used to run only on the first transition into `paid`. Marking that order paid again did not retry a failed sign-up, and the receipt had already gone out without a member code. This branch runs the idempotent activation on every mark-paid. If the retry is the call that creates the code, it sends the receipt again.

## Medium Priority Issues

- Points are awarded before the sign-up member exists, so the $15 fee earns nothing on the first mark-paid. A later mark-paid can award 1 point per dollar on that fee, because the member then exists and the award is retried. The join form submits the fee on its own.
- `CLUB_PROGRAM.approved` is `true`, with earning from 2026-10-20. `centsPerRedeemBlock` stays `null`, so points are not a checkout discount.
- `reports/project-overview.md` was still describing PayPal-only checkout and claiming there is no `vercel.json`. This branch corrects that description.
- CI runs lint, typecheck, and build. It does not run `npm test`.
- Draft health PRs #94, #99, #100, #103, #106, #109, #112, #115, #117, and #119 stop at older commits. Do not merge them over this report.
- Draft Whop checkout PRs are still open. Do not merge one onto this sign-up without keeping PayID, Australian shipping, and `normalizeShipping`.

## Low Priority Issues

- The spend tiers live at `/club/specials`. The path still says specials.
- Root `index.mts` and the `ai` dependency are still outside the storefront.
- `env.example` said PayPal credentials are read only when the provider flag is `paypal`. The flag `bank_transfer_only` is what hides PayPal. This branch corrects that comment.
- The 25 September health report on this branch still described Stripe store-credit coupons. It is replaced by this file.

## Changes Made

- Hide the join popup when the pathname is no longer an invite route, and release the scroll lock. The $15 copy and dismissal key `redline-club-invite-v4` are unchanged.
- Retry club activation when an order is marked paid again, and send the member code if that retry creates it.
- Replace the stale website health report and correct the project overview's payment and Vercel description.

## Tests Performed

- `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test` on the club invite, club rules, membership, mailer, admin mark-paid, and orders-club files: 50 passed, 0 failed. Includes the new checkout-close and sign-up retry cases.
- `npm ci` failed in this environment with `SSL_ERROR_SYSCALL` to `registry.npmjs.org` while fetching `@neondatabase/serverless`. Lint, `tsc`, and `next build` were not run locally. A local Neon stub was used only so the unit tests could load, and it was not committed.
- No browser pass. The dev server needs the install that could not finish. The close behaviour is covered by `shouldKeepInviteOpen` for `/checkout`, `/checkout/success`, `/club`, `/club/balance`, and `/order/[reference]`.

## Build Status

GitHub CI for `7f2cafe` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/39358730384

GitHub recorded production deployment `7189915695` for that commit as successful. This health branch is not deployed. Do not promote it unless asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- When asked to align the club schema, take that change from draft PR #115 and keep this later health report. Do not merge #115 or #119 as they stand.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Do not copy the values into the repo or this report.
- Decide whether a repeated mark-paid on the $15 fee should keep earning zero points.

## Recommendations

- Keep the Redline Labs black and gold storefront.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build, not proof that PayID or the club secret is set.
- Keep one health report on top. Older draft health PRs will overwrite this one if they merge.
