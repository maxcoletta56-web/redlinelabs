# Redlinelabs Website Health

Last Updated: 27 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `e19511f` (PR #137). Approved distribution accounts now see a box price on listed sizes: 10% off that item's sheet price, with a minimum of five boxes of that size. The discount is not taken off the quote total. Shop catalogue prices are unchanged. Quotes remain DQ references and are not charged at shop checkout. GitHub CI run `40473381347` passed lint, typecheck, and build. GitHub recorded production deployment `7353704044` as successful. This environment cannot open TLS to `redlinelabs.shop`, so the live pages were not opened here. The storefront is still Redline Labs black and gold.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in stays closed until `DISTRIBUTION_SESSION_SECRET` is set, or `ADMIN_API_SECRET` is at least 16 characters.

## High Priority Issues

- Seventeen of 47 distribution quote rows have no sheet price and show "Box price on request". A quote that includes any of them is stored as `requested`, and the quote total reads "Price not set" until the desk prices the open rows. The priced rows on that same quote already carry their discounted box price. The open rows are DSIP 10 MG (`Dsip10`), DSIP Nasal Spray (`DsipNS`), Epitalon 10 MG (`Epi10`), Melanotan 2 Nasal Spray (`MT2NS`), BPC-157 10 MG (`BPC157`), Retatrutide 30 MG (`Ret1010`), CJC/Ipamorelin 5/5 MG (`Cjcipa55`), CJC/Ipamorelin 10/5 MG (`Cjcipa105`), NAD+ 500 MG (`Nad500`), TB-1 (`Tb111`), BPC-157/TB-500 blend (`Blendtbbpc`), GHK-1200 (`GHK1200`), CJC-1295 (`CJC1295`), Selank Nasal Spray (`SelankNS`), MOTS-C 20 MG (`Motc20`), Semax 30 MG (`Semax30`), and Semax Nasal Spray (`SemaxNS`). Every key in the sheet map matches a catalogue SKU. Tesamorelin/Ipamorelin, TA1, and BAC water 20 ml are not catalogue listings. SLU-PP-332 (`Slupp37`) uses the sheet price published as SLU-PP-375 5 mg, then 10% off ($337.50). Do not invent the missing sheet prices.
- The join popup still stays open after a client navigation onto checkout. `ClubInviteModal` opens from `shouldInviteOnPath` and sets `document.body.style.overflow` to `hidden`. There is no `shouldKeepInviteOpen`. The dialog is `z-[45]` and the cart drawer is `z-50`, so Checkout can navigate while the dialog is open. `/distribution` is not an invite route. Do not restyle the popup from a health pass. Draft PR #122 stops at `7f2cafe`. Do not merge it as it stands.
- `vercel.json` still builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production skips both schema scripts. Distribution tables are still created on first use. Club runtime creation still does not hash legacy plaintext member codes and does not drop `NOT NULL` on `member_code`. Draft PR #115 edits `vercel.json` and does not include the distribution script. Do not open a second `vercel.json`. Do not merge #115 unless asked.
- `/club` and `/club/specials` are indexable and are missing from `src/app/sitemap.ts`. `/club/balance` is `noindex` and should stay out of the sitemap. `/distribution` is `noindex`, `robots.ts` disallows it, and the sitemap does not list it. Draft health PR #136 records the club sitemap gap and stops at `07bd476`. Do not merge #136 over this report.

## Medium Priority Issues

- The portal copy says each product needs five boxes. The server rejects each size on its own: five boxes of DSIP 15 MG do not cover DSIP 10 MG. A line of four is rejected even when the rest of the quote is larger. The form sets `min` to 5, and the server ignores a box price typed into the request.
- A quote whose every line has a sheet price is stored as `quoted` immediately. It does not sit in the desk's awaiting-price count. The desk can still replace a saved box price. A declined quote still cannot be repriced.
- Catalogue photos are unchanged from `07bd476`. Sixteen listings use the original WordPress photographs and fourteen stay on generated vials. Printed doses on some of those photographs do not match the only option, including Ipamorelin. Do not replace the photos from this pass.
- The header still lists Home, Shop, Club, About, FAQ, Contact, and Distribution from the `lg` breakpoint. This pass did not open a browser, so crowding at 1024px is unverified.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Points do not reduce checkout. The club price is a one-time $15 sign-up.
- CI runs lint, typecheck, and build. It does not run `npm test`.
- `reports/ecommerce-cro-health.md` and `reports/security-compliance-health.md` still name Stripe. Stripe is not on this commit. Do not rewrite those reports from this pass, and do not reintroduce Stripe from them.
- Open Whop checkout PRs include #138 and #139, both aimed at this production branch. Do not merge one onto this checkout without keeping PayID, Australian shipping, and `normalizeShipping`.

## Low Priority Issues

- The spend tiers live at `/club/specials`. The path still says specials.
- Root `index.mts` and the `ai` dependency are still outside the storefront.
- The first paragraph of the #137 commit message still says four boxes. The code, the tests, and the second paragraph require five.

## Changes Made

- Replaced the health report that still described production as `72ef9e3` with this record of `e19511f`.
- Noted the distributor box price, the five-box minimum, and the 17 unpriced sizes in `reports/project-overview.md`. Checkout code is unchanged.

## Tests Performed

- Inspected the #137 diff: sheet map, 10% rounding, per-line minimum, quote status, desk price replacement, and the portal copy.
- Compared all 47 catalogue quote rows with `DISTRIBUTION_BOX_CENTS`. Thirty rows are listed, seventeen are open, and no sheet key is missing from the catalogue. Every listed sheet price divides evenly by the 10% discount.
- Distribution unit tests, with an uncommitted local stub of `@neondatabase/serverless`: 15 passed, 0 failed (`distribution.test.ts`, `distribution-mail.test.ts`, `distribution-db.test.ts`). The stub was removed and was not committed. The full `npm test` suite was not run.
- GitHub CI for `e19511f` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40473381347
- `curl` to `https://redlinelabs.shop/distribution` failed in this environment with `SSL_ERROR_SYSCALL` before a status code.
- `node_modules` was absent. `npm ci` was not retried. Lint, `tsc`, and `next build` were not repeated locally. CI already passed those for `e19511f`.

## Build Status

GitHub CI for `e19511f` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40473381347

GitHub recorded production deployment `7353704044` for `e19511f` as successful. This health branch is not a production deploy. Do not promote it unless asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Add sheet prices for the seventeen open sizes. Until then those rows stay "on request", and any quote that includes one waits for the desk.
- Rebase the popup close onto the current production commit when asked. Do not merge #122, #119, #115, #136, #135, #130, or #128 over this report.
- When asked to align `vercel.json`, include `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`, and keep this report.
- When asked to extend the sitemap, add `/club` and `/club/specials` only. Leave `/club/balance` and `/distribution` out.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `ADMIN_API_SECRET`, `DISTRIBUTION_SESSION_SECRET`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Do not copy the values into the repo or this report.

## Recommendations

- Keep the Redline Labs black and gold storefront. Do not restyle the club popup from a health pass.
- Leave the 10% discount on each listed box. Do not take it off the quote total, and do not change shop catalogue prices.
- Leave distribution quotes off shop checkout. The desk can still replace a saved box price.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build, not proof that PayID, the admin secret, or the distribution secret is set.
- Keep one health report on top. Older draft health PRs will overwrite this one if they merge.
