# Redlinelabs Website Health

Last Updated: 29 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `8a52fbb` (PR #144). Every catalogue photo is now the same 1024×1024 research vial. The gold name matches the listing, and the white badge lists the numeric strengths that are actually sold. GitHub CI run `40840805771` passed lint, typecheck, and build. GitHub recorded production deployment `7407272543` as successful. This environment cannot open TLS to `redlinelabs.shop` (`SSL_ERROR_SYSCALL`), so the live pages were not opened here. The storefront is still Redline Labs black and gold.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in also stays closed until a session secret exists: `DISTRIBUTION_SESSION_SECRET`, or `ADMIN_API_SECRET` of at least 16 characters.

## High Priority Issues

- On `8a52fbb` the join popup stays mounted in `Providers`. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The dialog then keeps `document.body` scroll-locked. Opening depends on `shouldInviteOnPath`, which does not hide an already-open dialog. `shouldKeepInviteOpen` is still absent. Do not restyle the popup from a health pass. Draft PRs #122 and #119 stop at older commits. Do not merge them over this report.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production therefore skips both schema scripts. Distribution tables are created on first use by `ensureTable`. Club runtime creation still does not hash legacy plaintext member codes and does not drop `NOT NULL` on `member_code`. A paid $15 order can be stored while activation fails. Draft PR #115 already edits `vercel.json` and does not include the distribution script. Do not open a second `vercel.json`. Do not merge #115 unless asked.
- `/club` and `/club/specials` are indexable and missing from `sitemap.ts`. `/club/balance` is `noindex` and should stay out of the sitemap.

## Medium Priority Issues

- One photograph lists every numeric strength on a single vial. Checkout still sells one option per line. The CJC/IPAMORELIN badge reads `5/5 / 10/5 MG`, which matches options `5/5` and `10/5`. Nasal Spray stays off the badge for DSIP, Semax, and Selank. Melanotan 2 offers Vial and Nasal Spray only, so that label has no strength badge. Listings with no options, including GHK-CU and SLU-PP-332, also have no strength badge.
- GitHub recorded a successful Production deployment `7376701046` of `cf27960` on 28 October. That commit is open PR #142 (`rlorder-minimum-688b`) and is not in the history of `8a52fbb`. The later production-branch deploy of `8a52fbb` also succeeded. Do not treat #142 as merged.
- CI runs lint, typecheck, and build. It does not run `npm test`. The new name checks live in `src/lib/products.test.ts`.
- `reports/ecommerce-cro-health.md` and `reports/security-compliance-health.md` still name Stripe. `src/lib/stripe.ts` is not on `8a52fbb`. Do not rewrite those reports from a health pass, and do not reintroduce Stripe from them.
- Draft health PRs #94, #99, #100, #103, #106, #109, #112, #115, #117, #119, #122, #128, #130, #135, #136, and #140 stop at older commits. #140 records `e19511f` and would replace this report if it merged first. Do not merge them over this report.
- Draft and open Whop checkout PRs are still open, including #138, #139, #141, #143, and #145. Do not merge one onto this checkout without keeping PayID, Australian shipping, and `normalizeShipping`.
- The header list includes Distribution from the `lg` breakpoint. This pass did not open a browser, so crowding at 1024px is unverified.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Bronze, Silver, Gold, and Platinum start at $500, $1,000, $1,500, and $2,000. `centsPerRedeemBlock` stays `null`, so points do not reduce checkout. The price is a one-time $15 sign-up.

## Low Priority Issues

- `scripts/render-product-labels.py` is a one-shot painter. It is not part of `vercel.json` or `npm run build`. It expects ffmpeg and `/usr/share/fonts/truetype/macos/Inter-Bold.ttf`. The JPEGs in `public/products/` are the files the shop serves.
- The catalogue test checks that each name is uppercase and that `/products/{slug}.jpg` exists. It does not read the pixels.
- Display names `Epitalon`, `Kisspeptin`, and `Semax` are now `EPITALON`, `KISSPEPTIN`, and `SEMAX`, matching the other listings. Their descriptions stay in sentence case. The SLU-PP-332 description no longer mentions SLU-PP-322.
- The spend tiers live at `/club/specials`. The path still says specials.
- Root `index.mts` and the `ai` dependency are still outside the storefront.

## Changes Made

- Replaced the website health report with this record of `8a52fbb`.
- Noted in `reports/project-overview.md` that catalogue photos are 1024×1024 JPEGs painted from one vial so the label name and numeric strengths match the listing.

## Tests Performed

- Inspected the #144 diff: 30 JPEGs, `scripts/render-product-labels.py`, `scripts/assets/vial-label-base.jpg`, three uppercase names, the SLU-PP-332 description, and two catalogue tests.
- Simulated the painter’s dose line for all 30 listings against `src/data/products.json`. Every numeric option is included. Form options such as Nasal Spray are left off the badge.
- Measured all 30 files in `public/products/`. Each is a 1024×1024 JPEG.
- Read the rendered labels for Ipamorelin (`10 MG`), DSIP (`10 / 15 MG`), BPC-157 (`10 / 13 / 20 MG`), Retatrutide (`10 / 13 / 20 / 30 MG`), CJC/IPAMORELIN (`5/5 / 10/5 MG`), Semax (`10 / 30 MG`), Bacterial Water (`10 ML` on two name lines), GHK-CU (name only), SLU-PP-332 (name only), and Melanotan 2 (name only). Each name matched the listing.
- `node --experimental-strip-types --test src/lib/products.test.ts`: 9 passed, 0 failed.
- GitHub CI for `8a52fbb` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40840805771
- `curl` to `https://redlinelabs.shop/` connected, then failed with `SSL_ERROR_SYSCALL` before a status code.
- `npm ci` failed with `ECONNRESET` while fetching `@neondatabase/serverless` from `registry.npmjs.org`. Lint, `tsc`, and `next build` were not repeated locally. CI already passed those for `8a52fbb`. This branch changes only the two report files.

## Build Status

GitHub CI for `8a52fbb` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40840805771

GitHub recorded production deployment `7407272543` for `8a52fbb` as successful. This health branch is not a production deploy. Do not promote it unless asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Hide the club dialog during render when the path is checkout, an order, or `/club`, and retry membership activation on mark-paid. Rebase that work onto `8a52fbb`. Do not merge #122 or #119 as they stand.
- When asked to align `vercel.json`, include `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`, and keep this report.
- Add `/club` and `/club/specials` to `sitemap.ts`. Leave `/club/balance` out.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `ADMIN_API_SECRET`, `DISTRIBUTION_SESSION_SECRET`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Do not copy the values into the repo or this report.
- Check the header at the `lg` breakpoint after Distribution was added.

## Recommendations

- Keep the Redline Labs black and gold storefront. Do not restyle the club popup from a health pass.
- Leave the committed JPEGs in place. Re-run `scripts/render-product-labels.py` only when a listing name or numeric strength changes.
- Leave distribution quotes off shop checkout. The box price is entered on the desk.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build, not proof that PayID, the admin secret, or the distribution secret is set.
- Keep one health report on top. Older health PRs will overwrite this one if they merge.
