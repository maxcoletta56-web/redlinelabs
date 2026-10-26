# Redlinelabs Website Health

Last Updated: 26 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is still at `07bd476` (PR #133). A later fetch did not move the tip. Sixteen catalogue listings use the original WordPress photographs. Fourteen stay on the generated black-and-gold vials. GitHub CI run `40318841194` passed lint, typecheck, and build. GitHub recorded production deployment `7331222605` as successful. This environment cannot complete TLS to `redlinelabs.shop`, so the live pages were not opened here. The storefront is still Redline Labs black and gold. Checkout code did not change in that commit. This pass also found that `/club` and `/club/specials` are missing from the sitemap, and that the September specialist reports still describe Stripe.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in also stays closed until a session secret exists: `DISTRIBUTION_SESSION_SECRET`, or `ADMIN_API_SECRET` of at least 16 characters.

## High Priority Issues

- Fourteen of the sixteen WordPress photos print one strength. The shop card, product page, cart, and drawer all use that single file for every option.
  - `ipamorelin` prints 5mg. The only option is 10 MG.
  - `dsip` prints 5mg. The options are 10 MG, 15 MG, and Nasal Spray. 5mg is not an option.
  - `bpc-157` prints 10mg. The options are 10, 13, and 20 MG.
  - `retatrutide` (featured) prints 10mg. The options are 10, 13, 20, and 30 MG.
  - `cjc-ipamorelin` (featured) prints 10mg. The options are 5/5 and 10/5 MG.
  - `nad-plus` prints 500mg. The options are 500 and 1000 MG.
  - `epitalon` prints 10mg. The options are 10 and 50 MG.
  - These listings have no options, and the photo still prints a dose: `ghk-cu` 50mg (featured), `bpc-tb-blend` 5mg/5mg, `kisspeptin` 10mg, `slu-pp-332` 5mg, `tb-1` 10mg, `ss-31` 10mg, `kpv` 10mg. The `tb-1` description says no composition claim is published on the page.
  - `tesamorelin` prints 10mg and its only option is 10 MG. `klow` prints 80mg and its only option is 80 MG.
  - `src/lib/products.test.ts` only checks that `/products/{slug}.jpg` exists. It does not compare a printed dose with the options.
  - Leave these files for the catalogue agent. A shared photo should print a dose only when that dose is the only option, and should list every strength when a listing has more than one.
- On `07bd476` the join popup stays mounted in `Providers`. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The dialog then keeps `document.body` scroll-locked. Opening depends on `shouldInviteOnPath`, which does not hide an already-open dialog. `shouldKeepInviteOpen` is still absent. Draft PR #122 (`rlredlinelabs-website-health-a440`) stops at `7f2cafe`. Do not merge #122 as it stands. Rebase that hide-during-render fix and the mark-paid sign-up retry when asked. Do not merge #119 over it.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production therefore skips both schema scripts. Distribution tables are created on first use by `ensureTable` in `src/lib/distribution-db.ts`. Club runtime creation still does not hash legacy plaintext member codes and does not drop `NOT NULL` on `member_code`. A paid $15 order can be stored while activation fails. Draft PR #115 already edits `vercel.json` and does not include the distribution script. Do not open a second `vercel.json`. Do not merge #115 unless asked. If that alignment is redone, include both omitted scripts and keep this report.

## Medium Priority Issues

- The sixteen WordPress files are not square. Measured sizes are 800×533 (`bpc-157`, `cjc-ipamorelin`), 600×800 (`bpc-tb-blend`, `dsip`, `epitalon`, `ghk-cu`, `ipamorelin`, `kisspeptin`, `klow`, `retatrutide`, `ss-31`, `tb-1`), 640×800 (`kpv`), 533×800 (`tesamorelin`), and 450×800 (`nad-plus`, `slu-pp-332`). Catalogue and product frames are `aspect-square` with `object-contain`, so these letterbox. The 450px-wide files will look soft in a large card.
- Fourteen listings stay on generated 1024×1024 vials because those source files still return 403 and 502. This commit rewrote `glow`, `igf-1`, `mots-c`, `selank`, `semax`, and `tb-500`. Opened labels match the MG options on `glow` (70 MG), `mots-c` (10 MG / 20 MG), `tb-500` (12 MG / 20 MG), `semax` (10 MG / 30 MG), and `selank` (10 MG). Semax and Selank also sell a nasal spray, which is not printed. Unchanged from `2119f78`: `bacterial-water`, `cjc-1295`, `ghk-1200`, `hcg`, `hmg`, `melanotan-2`, `pt-141`, `tb4`.
- `reports/catalogue-merchandising-health.md` still describes remote `i0.wp.com` URLs and a generic vial fallback. That audit is no longer true. Leave it for the catalogue agent.
- `src/app/sitemap.ts` lists the policy pages, `/comments`, and every product. It does not list `/club` or `/club/specials`. Both are linked from the header or the club page, both use `pageMetadata` with indexing on, and `robots.ts` does not disallow them. `/club/balance` is `noindex` and should stay out of the sitemap. Leave the sitemap edit to the SEO agent. Do not rebuild the club.
- `reports/ecommerce-cro-health.md`, `reports/security-compliance-health.md`, `reports/qa-performance-health.md`, and `reports/seo-aeo-health.md` are still the September scaffolds. Ecommerce and security still name Stripe embedded checkout and `src/lib/stripe.ts`. Those files are not on `07bd476` (`src/lib/payoneer.ts` is gone as well). Do not treat the scaffolds as the current architecture, and do not reintroduce Stripe from them. `reports/project-overview.md` on this health line is the current description. Do not rewrite the specialist reports from this pass.
- Distribution remains a header link from the `lg` breakpoint with no wrap. Crowding at 1024px is still unverified in a browser. The page is `noindex`.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Points do not reduce checkout (`centsPerRedeemBlock` is null). The price is a one-time $15 sign-up.
- CI runs lint, typecheck, and build. It does not run `npm test`.
- Draft health PRs #94, #99, #100, #103, #106, #109, #112, #115, #117, #119, #122, #128, and #130 stop at older commits. #130 records `9f83497` and still describes production before these photos. Draft PR #135 records the same photo deploy and stops before the sitemap note. Do not merge any of them over this report.
- Draft Whop checkout PRs are still open, including #132 and #131 against this production branch, and #134 against the vial-label branch. Do not merge one onto this checkout without keeping PayID, Australian shipping, and `normalizeShipping`.

## Low Priority Issues

- `slu-pp-332` is titled SLU-PP-332. The description still adds "(Catalogue name: SLU-PP-322.)".
- The spend tiers live at `/club/specials`. The path still says specials.
- Root `index.mts` and the `ai` dependency are still outside the storefront.

## Changes Made

- Replaced the health report that still named `72ef9e3` with this record of `07bd476`.
- Noted in `reports/project-overview.md` that catalogue images are local files, sixteen of them the original WordPress photographs and fourteen generated vials.
- Recorded that `/club` and `/club/specials` are indexable and absent from the sitemap.
- Recorded that the September specialist reports still describe Stripe files that are not in the tree.

## Tests Performed

- Inspected the #133 diff: 22 JPEGs and a renamed test. Compared dimensions with `9f83497`. Read the sixteen WordPress photos and the five regenerated vials named above. Compared each printed dose with `src/data/products.json`.
- Confirmed `ClubInviteModal` still has no `shouldKeepInviteOpen`, and `vercel.json` still omits the club and distribution scripts. This commit did not touch checkout.
- `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test src/lib/products.test.ts`: 7 passed, 0 failed. Re-ran the same file in this pass: 7 passed, 0 failed. The image test only checks that the file exists.
- GitHub CI for `07bd476` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40318841194
- `curl` to `https://redlinelabs.shop/` connected, then failed with `SSL_ERROR_SYSCALL` before a status code.
- `node_modules` was absent at the start of this pass. Lint, `tsc`, and `next build` were not repeated locally. CI already passed those for `07bd476`. This commit changes the health report only.
- Re-fetched `cursor/redlinelabs-shop-1c01`. The tip was still `07bd476`. Compared `products.json` options for the labelled listings with the photo notes. Opened `public/products/ipamorelin.jpg` (vial prints 5mg; the only option is 10 MG) and `public/products/tesamorelin.jpg` (vial prints 10mg; the only option is 10 MG).
- Confirmed `src/lib/stripe.ts` and `src/lib/payoneer.ts` are absent, and that the sitemap's public routes omit `/club` and `/club/specials`.
- Measured four WordPress files: `ipamorelin` 600×800, `tesamorelin` 533×800, `nad-plus` 450×800, `bpc-157` 800×533. Those match the sizes already listed above.
- `curl` to `https://redlinelabs.shop/` failed again in this environment with `SSL_ERROR_SYSCALL` before a status code.
- `npm ci` failed with `ECONNRESET` while fetching `@neondatabase/serverless` from `registry.npmjs.org`. `npm run check` was not run locally.
- This pass started from `9e018d8`, 115 commits behind production. The audit used `07bd476`, not that tree.

## Build Status

GitHub CI for `07bd476` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40318841194

GitHub recorded production deployment `7331222605` for `07bd476` as successful. This health branch is not a production deploy. Do not promote it unless asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Replace the WordPress photos that print a dose the listing does not sell, or print every strength the way the generated MG vials do. `tesamorelin` and `klow` already match their only option.
- Rebase the popup close and the mark-paid sign-up retry from PR #122 onto the current production commit. Do not merge #122, #119, #115, #128, or #130 as they stand.
- When asked to align `vercel.json`, include `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`, and keep this report.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `ADMIN_API_SECRET`, `DISTRIBUTION_SESSION_SECRET`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Do not copy the values into the repo or this report.
- Ask the catalogue agent to replace `reports/catalogue-merchandising-health.md`. The September remote-image audit is stale.
- Ask the SEO agent to add `/club` and `/club/specials` to `sitemap.ts`. Leave `/club/balance` out.
- Ask the ecommerce, security, QA, and SEO agents to replace their September scaffolds. Do not reintroduce Stripe from those files.
- Do not merge draft PR #135 over this report. It records the photos and stops before the sitemap note.

## Recommendations

- Keep the Redline Labs black and gold storefront. Do not restyle the club popup from a health pass.
- Keep one shared photo per listing from showing a single dose when the listing sells more than one strength.
- Leave distribution quotes off shop checkout. The box price is entered on the desk.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build, not proof that PayID, the admin secret, or the distribution secret is set.
- Keep one health report on top. Older draft health PRs, including #135, will drop the sitemap note if they merge over this file.
- Point specialist agents at `reports/project-overview.md` until their own reports are rewritten.
