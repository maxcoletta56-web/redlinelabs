# Redlinelabs Website Health

Last Updated: 25 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `2119f78` (PR #127). Every catalogue listing now uses a local black-and-gold vial at `/products/{slug}.jpg`. GitHub CI run `40181843212` passed lint, typecheck, and build. GitHub recorded production deployment `7311363724` as successful. This environment cannot open TLS to `redlinelabs.shop` or `*.vercel.app`, so the live pages were not opened in a browser. The storefront is still Redline Labs black and gold.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in also stays closed until a session secret exists: `DISTRIBUTION_SESSION_SECRET`, or `ADMIN_API_SECRET` of at least 16 characters.

## High Priority Issues

- On `2119f78` the join popup stays mounted in `Providers`. `ClubInviteModal` opens from `shouldInviteOnPath` and never closes on a later client navigation. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The dialog then keeps `document.body` scroll-locked. The hide-during-render fix and the mark-paid sign-up retry are on draft PR #122 (`rlredlinelabs-website-health-a440`), which stops at `7f2cafe`. Leave #122 unmerged. Rebase that code onto this report when asked. Leave #119 unmerged as well.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production therefore skips both schema scripts. Distribution tables are created on first use by `ensureTable` in `src/lib/distribution-db.ts`. Club runtime creation still does not hash legacy plaintext member codes and does not drop `NOT NULL` on `member_code`. A paid $15 order can be stored while activation fails. Draft PR #115 already edits `vercel.json` and does not include the distribution script. Leave that file to one change. Leave #115 unmerged unless asked. If that alignment is redone, include both omitted scripts and keep this report.
- Draft health PR #126 (`rlredlinelabs-website-health-a791`) records `72ef9e3` and would replace this later report if it merged. Leave #126, and the older drafts #94, #99, #100, #103, #106, #109, #112, #115, #117, #119, and #122, unmerged.

## Medium Priority Issues

- A cart saved before this deploy still holds the old `i0.wp.com` image URL. `ProductImage` falls back to `/brand/vial.png` when that URL fails. New shop, product, and add-to-cart paths store `/products/{slug}.jpg`. `next.config.ts` still allows `i0.wp.com` under `/redlinelabs.shop/**`, and the content-security policy still allows that host, so an old URL that still loads can render.
- Distribution is a primary header link and a footer link. The header list is Home, Shop, Club, About, FAQ, Contact, and Distribution, shown from the `lg` breakpoint. This pass did not open a browser, so crowding at 1024px is unverified.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Bronze, Silver, Gold, and Platinum start at $500, $1,000, $1,500, and $2,000. `centsPerRedeemBlock` stays `null`, so points do not reduce checkout. The price is a one-time $15 sign-up.
- CI runs lint, typecheck, and build. It does not run `npm test`. The new image assertion is in `src/lib/products.test.ts`.
- The sibling reports on this branch (`seo-aeo-health.md`, `catalogue-merchandising-health.md`, `ecommerce-cro-health.md`, `qa-performance-health.md`, `security-compliance-health.md`) are still the September scaffolds. They still describe Stripe, Payoneer, and remote `i0.wp.com` photos. This pass left them in place so a later specialist edit is not overwritten.
- Draft Whop checkout PRs are still open, including #125. Keep PayID, Australian shipping, and `normalizeShipping` if one of those is merged later.

## Low Priority Issues

- `npm test` prints a `MODULE_TYPELESS_PACKAGE_JSON` warning because `package.json` has no `"type": "module"`.
- Root `index.mts` and the `ai` dependency are still outside the storefront.
- The spend tiers live at `/club/specials`. The path still says specials.
- The 25 September copy of this report described Stripe store-credit coupons. It is replaced by this file.

## Changes Made

- Replaced the 25 September website health report with this record of `2119f78`.
- Corrected `reports/project-overview.md` so it names PayID, PayPal beside it, the $15 club, distribution logins, `vercel.json`, `VercelTelemetry`, and the local vial photos.
- Corrected the PayPal comment in `env.example`, and noted that the Vercel build command skips the club and distribution schema scripts.
- Left the catalogue images, checkout, club popup, and `vercel.json` as they are on production.

## Tests Performed

- Confirmed all 30 files in `public/products/` are JPEG (SOI/EOI), 1024×1024, and about 76–84 KB.
- Confirmed every `products.json` image is `/products/{slug}.jpg` and that file exists. The new unit test asserts the same thing.
- Read all 30 labels. Single-option listings print that option: Bacterial Water 10ml, Ipamorelin 10mg, IGF-1 1mg, Glow 70mg, Klow 80mg, HMG 75 IU, Tesamorelin 10mg. Listings with zero or several options print the name only, including BPC-157, HCG, Retatrutide, Selank, Semax, NAD+, MOTS-C, TB-500, CJC/Ipamorelin, DSIP, Epitalon, and Melanotan 2.
- Product cards and the product page pass those local paths to `ProductImage` with `fill` inside a `relative aspect-square` frame.
- `node --experimental-strip-types --import ./scripts/register-test-hooks.mjs --test src/lib/products.test.ts src/lib/slugs.test.ts`: 9 passed, 0 failed.
- GitHub CI for `2119f78` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40181843212
- `curl` to `https://redlinelabs.shop/shop`, `https://redlinelabs.shop/products/bpc-157.jpg`, and the Vercel production deployment host failed in this environment with TLS error 35 before a status code.
- `node_modules` is absent here, and earlier runs could not reach `registry.npmjs.org`. Lint, `tsc`, and `next build` were not repeated locally. CI already passed those for `2119f78`. This branch changes reports and `env.example` comments only.

## Build Status

GitHub CI for `2119f78` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40181843212

GitHub recorded production deployment `7311363724` for `2119f78` as successful. This health branch is not a production deploy. Promote it only when explicitly asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Rebase the popup close and the mark-paid sign-up retry from PR #122 onto the current production commit. Leave #122, #119, #115, and #126 unmerged as they stand.
- When asked to align `vercel.json`, include `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`, and keep this report.
- Confirm `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, `ADMIN_API_SECRET`, `DISTRIBUTION_SESSION_SECRET`, `CLUB_CODE_SECRET`, PayPal, and Resend on the Vercel project by name only. Keep the values out of the repo and this report.
- Check the header at the `lg` breakpoint after Distribution was added.
- Ask the catalogue specialist to replace the September image findings. Remote `i0.wp.com` 403s are no longer the live catalogue.
- Ask the other specialists to refresh their September scaffolds. Checkout is PayID with PayPal beside it, and analytics is `VercelTelemetry`.

## Recommendations

- Keep the Redline Labs black and gold storefront. Leave the club popup styling unchanged in a health pass.
- Leave distribution quotes off shop checkout. The box price is entered on the desk.
- Leave `centsPerRedeemBlock` null so points stay off the checkout total.
- Treat a green Vercel deploy as a successful build. It does not prove that PayID, the admin secret, or the distribution secret is set.
- Keep one health report on top. Older draft health PRs will overwrite this one if they merge.
