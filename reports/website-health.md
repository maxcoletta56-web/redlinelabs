# Redlinelabs Website Health

Last Updated: 25 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `72ef9e3` (PR #124). That commit adds a distribution login, separate from shop accounts. Applications stay pending until the distribution desk approves them. Approved accounts request box quantities under DQ references, and the box price stays blank until the desk enters it. GitHub CI run `40167397689` passed lint, typecheck, and build. GitHub recorded production deployment `7309312367` as successful. This environment cannot open TLS to `redlinelabs.shop` or `*.vercel.app`, so the live pages were not opened here. The storefront is still Redline Labs black and gold.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in also stays closed until a session secret exists: `DISTRIBUTION_SESSION_SECRET`, or `ADMIN_API_SECRET` of at least 16 characters.

## High Priority Issues

- On `72ef9e3` the join popup stays mounted in `Providers`. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The dialog then keeps `document.body` scroll-locked. Opening depends on `shouldInviteOnPath`, which does not hide an already-open dialog. `/distribution` is not an invite route. The hide-during-render fix and the mark-paid sign-up retry are on draft PR #122 (`rlredlinelabs-website-health-a440`), which stops at `7f2cafe`. Do not merge #122 as it stands. Rebase that code onto this report when asked. Do not merge #119 over it.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production therefore skips both schema scripts. Distribution tables are created on first use by `ensureTable` in `src/lib/distribution-db.ts`, matching `db/distribution.sql`. Club runtime creation still does not hash legacy plaintext member codes and does not drop `NOT NULL` on `member_code`. A paid $15 order can be stored while activation fails. Draft PR #115 already edits `vercel.json` and does not include the distribution script. Do not open a second `vercel.json`. Do not merge #115 unless asked. If that alignment is redone, include both omitted scripts and keep this report.
- `reports/project-overview.md` on `72ef9e3` still described PayPal-only checkout and claimed there is no `vercel.json`. `env.example` said PayPal credentials are read only when the provider flag is `paypal`. PayPal is offered beside PayID when both secrets are set, unless the flag is `bank_transfer_only`. This branch corrects those descriptions. It does not change checkout.

## Medium Priority Issues

- Distribution is a new primary header link and a footer link. The header list is now Home, Shop, Club, About, FAQ, Contact, and Distribution, shown from the `lg` breakpoint with no wrap. This pass did not open a browser, so crowding at 1024px is unverified. The page is `noindex`, `robots.txt` disallows `/distribution`, and the sitemap does not list it.
- The public distribution page renders signed out when the session secret is missing. A signed-in load that cannot read the database shows "Could not load this account" instead of a 500. Quotes are requests, not shop orders, and they are not charged at shop checkout.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Bronze, Silver, Gold, and Platinum start at $500, $1,000, $1,500, and $2,000. `centsPerRedeemBlock` stays `null`, so points do not reduce checkout. The price is a one-time $15 sign-up.
- CI runs lint, typecheck, and build. It does not run `npm test`. The distribution tests landed in `src/lib/distribution*.test.ts` and `src/lib/admin-orders.test.ts`.
- Draft health PRs #94, #99, #100, #103, #106, #109, #112, #115, #117, #119, and #122 stop at older commits. Do not merge them over this report.
- Draft Whop checkout PRs are still open, including #125. Do not merge one onto this checkout without keeping PayID, Australian shipping, and `normalizeShipping`.

## Low Priority Issues

- The spend tiers live at `/club/specials`. The path still says specials.
- Root `index.mts` and the `ai` dependency are still outside the storefront.
- The 25 September copy of this report described Stripe store-credit coupons. It is replaced by this file.

## Changes Made

- Replaced the 25 September website health report with this record of `72ef9e3`.
- Corrected `reports/project-overview.md` so it names PayID, PayPal beside it, the $15 club, distribution logins, `vercel.json`, and `VercelTelemetry`.
- Corrected the PayPal comment in `env.example`, and noted that the Vercel build command skips the club and distribution schema scripts.

## Tests Performed

- Inspected the #124 diff, the distribution page and desk, session secret fallback, `adminDeskPath`, `robots.ts`, the header and footer links, `vercel.json`, and runtime `ensureTable` for the new tables.
- GitHub CI for `72ef9e3` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40167397689
- `curl` to `https://redlinelabs.shop/` failed in this environment with TLS error 35 before a status code. The same failure applied to `/distribution`, `/shop`, `/checkout`, `/admin/distribution`, and `/robots.txt`.
- `npm ci` failed with `ECONNRESET` while fetching `@neondatabase/serverless` from `registry.npmjs.org`. Lint, `tsc`, and `next build` were not repeated locally. CI already passed those for `72ef9e3`.
- With an uncommitted local stub of `@neondatabase/serverless`, `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test` on the distribution and admin-orders files: 27 passed, 0 failed. The stub was not committed. The full `npm test` suite was not run.

## Build Status

GitHub CI for `72ef9e3` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40167397689

GitHub recorded production deployment `7309312367` for `72ef9e3` as successful. This health branch is not a production deploy. Do not promote it unless asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Rebase the popup close and the mark-paid sign-up retry from PR #122 onto the current production commit. Do not merge #122, #119, or #115 as they stand.
- When asked to align `vercel.json`, include `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`, and keep this report.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `ADMIN_API_SECRET`, `DISTRIBUTION_SESSION_SECRET`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Do not copy the values into the repo or this report.
- Check the header at the `lg` breakpoint after Distribution was added.

## Recommendations

- Keep the Redline Labs black and gold storefront. Do not restyle the club popup from a health pass.
- Leave distribution quotes off shop checkout. The box price is entered on the desk.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build, not proof that PayID, the admin secret, or the distribution secret is set.
- Keep one health report on top. Older draft health PRs will overwrite this one if they merge.
