# Redlinelabs Website Health

Last Updated: 29 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `e141d97` (PR #146). Numeric catalogue strengths now sit in a gold double rule on the shared black-and-gold vial. Eighteen listings with a numeric option were regenerated. Twelve listings with no numeric option still show the name only. GitHub CI run `40849199915` passed lint, typecheck, and build. GitHub recorded production deployment `7408492827` as successful. This environment cannot open TLS to `redlinelabs.shop`, so the live shop was not opened here. The storefront is still Redline Labs black and gold.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in stays closed until a session secret exists: `DISTRIBUTION_SESSION_SECRET`, or `ADMIN_API_SECRET` of at least 16 characters.

## High Priority Issues

- The join popup stays mounted in `Providers`. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The dialog then keeps `document.body` scroll-locked. Opening depends on `shouldInviteOnPath`. `shouldKeepInviteOpen` is still absent on `e141d97`. The hide-during-render fix is on draft PR #122 (`rlredlinelabs-website-health-a440`), which stops at `7f2cafe`. Do not merge #122 as it stands. Rebase that close onto the current production commit when asked.
- A paid club sign-up calls `activatePaidMembership` only when the order was not already `paid`. Marking the same order paid again retries the points award and does not retry activation. A $15 order can stay paid while the membership never opens. Draft PR #122 also carries an activation retry and stops at `7f2cafe`. Rebase that retry with the popup close. Do not merge #122 over this report.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production therefore skips both schema scripts. Distribution tables are created on first use by `ensureTable` in `src/lib/distribution-db.ts`. Club runtime creation still does not hash legacy plaintext member codes the way the build script does. Draft PR #115 already edits `vercel.json` and does not include the distribution script. Do not open a second `vercel.json`. Do not merge #115 unless asked. If that alignment is redone, include both omitted scripts and keep this report.
- `/club` and `/club/specials` are indexable and missing from `sitemap.ts`. `/club/balance` is `noindex` and should stay out of the sitemap. `robots.ts` does not disallow `/club`.

## Medium Priority Issues

- The header lists Home, Shop, Club, About, FAQ, Contact, and Distribution, shown from the `lg` breakpoint with no wrap. This pass did not open a browser, so crowding at 1024px is unverified.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Bronze, Silver, Gold, and Platinum start at $500, $1,000, $1,500, and $2,000. `centsPerRedeemBlock` stays `null`, so points do not reduce checkout. The price is a one-time $15 sign-up.
- CI runs lint, typecheck, and build. It does not run `npm test`.
- `reports/ecommerce-cro-health.md` and `reports/security-compliance-health.md` still name Stripe and `src/lib/stripe.ts`. Those files are not on `e141d97`. Do not rewrite the specialist reports from a health pass, and do not reintroduce Stripe from them.
- Draft health PRs #106, #109, #112, #115, #117, #119, #122, #128, #130, #135, #136, and #140 stop at older commits. Do not merge them over this report. There is no earlier health report for `8a52fbb` or `e141d97`.
- Open PR #142 (`cf27960`, five-box minimum across the quote) is not an ancestor of `e141d97`. GitHub recorded production deployment `7376701046` for that unmerged SHA on 28 October. Do not treat #142 as merged.
- Draft and open Whop checkout PRs are still open, including #145, #143, #141, #139, and #138. Do not merge one onto this checkout without keeping PayID, Australian shipping, and `normalizeShipping`.

## Low Priority Issues

- Twelve listings have no numeric option, so the gold rule is omitted: `melanotan-2`, `ghk-cu`, `slu-pp-332`, `tb-1`, `bpc-tb-blend`, `kisspeptin`, `tb4`, `ghk-1200`, `cjc-1295`, `ss-31`, `kpv`, and `pt-141`. GHK-CU was read and shows the name only. That matches the painter.
- The spend tiers live at `/club/specials`. The path still says specials.
- Root `index.mts` and the `ai` dependency are still outside the storefront.
- The painter is `scripts/render-product-labels.py`. It is not part of the build. Re-run it only when a name or numeric strength changes. It needs ffmpeg and `/usr/share/fonts/truetype/macos/Inter-Bold.ttf`.

## Changes Made

- Replaced the 25 October website health report, which still named `72ef9e3`, with this record of `e141d97`.
- Noted in `reports/project-overview.md` that catalogue strengths use the gold double rule. Checkout, payments, and the build command are unchanged.

## Tests Performed

- Compared `e141d97` with `8a52fbb`. The diff is the painter and 18 JPEGs. `src/data/products.json` is unchanged.
- Mapped all 30 listings with the painter's numeric-option rule. The 18 regenerated files are exactly the listings with a numeric dose. Nasal Spray stays off DSIP, Selank, and Semax. The printed lines are `10 / 15 MG`, `10 / 50 MG`, `10 ML`, `10 / 13 / 20 MG`, `10 / 13 / 20 / 30 MG`, `5/5 / 10/5 MG`, `500 / 1000 MG`, `10 MG` (Ipamorelin), `1 MG`, `70 MG`, `80 MG`, `10 MG` (Selank), `10 / 20 MG`, `10 / 30 MG`, `75 IU`, `5000 / 10,000 IU`, `10 MG` (Tesamorelin), and `12 / 20 MG`.
- Read the JPEGs. Ipamorelin on `8a52fbb` has a white `10 MG` sticker. Ipamorelin on `e141d97` has a gold double rule reading `10 MG`. Retatrutide reads `10 / 13 / 20 / 30 MG`. HCG reads `5000 / 10,000 IU`. CJC/IPAMORELIN reads `5/5 / 10/5 MG`. GHK-CU has no strength rule. Each file is a 1024×1024 JPEG.
- Confirmed `shouldKeepInviteOpen` is absent, the drawer is `z-50`, `vercel.json` omits the club and distribution scripts, and `/club` plus `/club/specials` are absent from `sitemap.ts`.
- GitHub CI for `e141d97` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40849199915
- `curl` to `https://redlinelabs.shop/shop` failed in this environment with `SSL_ERROR_SYSCALL` before a status code.
- `node_modules` is absent. `npm ci` was not able to install `@neondatabase/serverless` from `registry.npmjs.org`, so lint, `tsc`, and `next build` were not repeated locally. CI already passed those for `e141d97`. This branch changes reports only.

## Build Status

GitHub CI for `e141d97` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40849199915

GitHub recorded production deployment `7408492827` for `e141d97` as successful. This health branch is not a production deploy. Do not promote it unless asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Rebase the popup close and the mark-paid sign-up retry from PR #122 onto `e141d97`. Do not merge #122, #119, or #115 as they stand.
- When asked to align `vercel.json`, include `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`, and keep this report.
- Add `/club` and `/club/specials` to `sitemap.ts` when asked. Leave `/club/balance` out.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `ADMIN_API_SECRET`, `DISTRIBUTION_SESSION_SECRET`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Do not copy the values into the repo or this report.
- Check the header at the `lg` breakpoint after Distribution was added.

## Recommendations

- Keep the Redline Labs black and gold storefront. Do not replace these vial photos from a health pass.
- Leave distribution quotes off shop checkout. The box price is entered on the desk.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build, not proof that PayID, the admin secret, or the distribution secret is set.
- Keep one health report on top. Older draft health PRs will overwrite this one if they merge.
