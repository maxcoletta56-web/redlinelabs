# Redlinelabs Website Health

Last Updated: 25 October 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `9f83497`, the merge of pull request #126 onto `2119f78` (PR #127). That merge changed `env.example`, `reports/project-overview.md`, and `reports/website-health.md` only. The 30 local vial JPEGs and the catalogue code from #127 are unchanged. The report #126 landed still says production is at `72ef9e3` and does not mention those photos. GitHub CI run `40183277525` passed lint, typecheck, and build for `9f83497`. GitHub recorded production deployment `7311569167` as successful. This environment cannot open TLS to `redlinelabs.shop` or `*.vercel.app`, so the live pages were not opened in a browser. The storefront is still Redline Labs black and gold.

## Critical Issues

None confirmed in this pass. PayID checkout and the order database still refuse to run when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, or `DATABASE_URL` are unset. A green deploy does not prove those variables are set. Distribution sign-in also stays closed until a session secret exists: `DISTRIBUTION_SESSION_SECRET`, or `ADMIN_API_SECRET` of at least 16 characters.

## High Priority Issues

- The health report on `9f83497` describes `72ef9e3`. PR #126 was written before PR #127 and was merged afterwards, so the committed report omits the named-vial catalogue that is already in that same commit. This branch replaces that report. It does not change the storefront.
- On `9f83497`, `ClubInviteModal` still opens from `shouldInviteOnPath` and never hides on a later client navigation. There is no `shouldKeepInviteOpen`. The cart drawer is `z-50` and the dialog is `z-[45]`, so Checkout can client-navigate to `/checkout` while the dialog is open. The open dialog then keeps `document.body` scroll-locked. The hide-during-render fix and the mark-paid sign-up retry are on draft PR #122 (`rlredlinelabs-website-health-a440`), which stops at `7f2cafe`. Leave #122 unmerged. Rebase that code onto this report when asked. Leave #119 unmerged as well.
- `vercel.json` builds with `node scripts/ensure-comments-table.mjs && node scripts/ensure-orders-table.mjs && next build`. `package.json` `build` also runs `scripts/ensure-club-tables.mjs` and `scripts/ensure-distribution-tables.mjs`. Production therefore skips both schema scripts. Distribution tables are created on first use by `ensureTable` in `src/lib/distribution-db.ts`. Club runtime creation still does not hash legacy plaintext member codes and does not drop `NOT NULL` on `member_code`. A paid $15 order can be stored while activation fails. Draft PR #115 already edits `vercel.json` and does not include the distribution script. Leave that file to one change. Leave #115 unmerged unless asked. If that alignment is redone, include both omitted scripts and keep this report.
- Draft health PR #128 (`rlredlinelabs-website-health-09e7`) records `2119f78` and tells reviewers to leave #126 unmerged. #126 has since merged. Leave #128 unmerged. It would replace this later report. Older drafts #94, #99, #100, #103, #106, #109, #112, #115, #117, #119, and #122 stop at older commits. Leave those unmerged as well.

## Medium Priority Issues

- A cart saved before `2119f78` can still hold an `i0.wp.com` image URL. `ProductImage` falls back to `/brand/vial.png` when that URL fails. New shop, product, and add-to-cart paths store `/products/{slug}.jpg`. `next.config.ts` still allows `i0.wp.com` under `/redlinelabs.shop/**`, and the content-security policy still allows that host, so an old URL that still loads can render.
- Distribution is a primary header link and a footer link. The header list is Home, Shop, Club, About, FAQ, Contact, and Distribution, shown from the `lg` breakpoint. This pass did not open a browser, so crowding at 1024px is unverified.
- `CLUB_PROGRAM.approved` is `true`. Earn 1 point per $1 from `2026-10-20T00:00:00.000Z`. Bronze, Silver, Gold, and Platinum start at $500, $1,000, $1,500, and $2,000. `centsPerRedeemBlock` stays `null`, so points do not reduce checkout. The price is a one-time $15 sign-up.
- CI runs lint, typecheck, and build. It does not run `npm test`. The image assertion is in `src/lib/products.test.ts`.
- The sibling reports (`seo-aeo-health.md`, `catalogue-merchandising-health.md`, `ecommerce-cro-health.md`, `qa-performance-health.md`, `security-compliance-health.md`) are still the September scaffolds. They still describe Stripe, Payoneer, and remote `i0.wp.com` photos. This pass left them in place so a later specialist edit is not overwritten.
- Draft Whop checkout PRs are still open, including #129 and #125. Keep PayID, Australian shipping, and `normalizeShipping` if one of those is merged later.

## Low Priority Issues

- `npm test` prints a `MODULE_TYPELESS_PACKAGE_JSON` warning because `package.json` has no `"type": "module"`. The catalogue test run in this pass printed that warning and still passed.
- Root `index.mts` and the `ai` dependency are still outside the storefront.
- The spend tiers live at `/club/specials`. The path still says specials.
- Twelve listings have an empty `variants` array and a product-level price. `resolveCartLines` sells those with `product.sku` and `minPrice`. That path is unchanged by this merge.

## Changes Made

- Replaced the report landed by #126, which still named `72ef9e3`, with this record of `9f83497`.
- Noted on the project-overview product row that each photo is a local `/products/{slug}.jpg` from `2119f78`, still present at `9f83497`.
- Left the PayID, PayPal, club, and distribution corrections from #126 in `reports/project-overview.md` and `env.example`.
- Left the catalogue images, checkout, club popup, and `vercel.json` as they are on production.

## Tests Performed

- `git diff 2119f78..9f83497` is limited to `env.example`, `reports/project-overview.md`, and `reports/website-health.md`.
- Confirmed all 30 files in `public/products/` are JPEG (SOI/EOI), 1024×1024, and 76,544–84,478 bytes.
- Confirmed every `products.json` image is `/products/{slug}.jpg`. `node --experimental-strip-types --test src/lib/products.test.ts`: 7 passed, 0 failed.
- Opened `public/products/bpc-157.jpg` (name only; BPC-157 has three options) and `public/products/bacterial-water.jpg` (label prints 10ml; the only option is 10 ML). The other 28 label readings were recorded on draft PR #128 against these same bytes. This pass did not re-open those 28 files.
- Read `ClubInviteModal`, `club-invite.ts`, `vercel.json`, `package.json` `build`, `ProductImage`, and the header and footer link lists on `9f83497`.
- GitHub CI for `9f83497` passed: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40183277525
- `curl` to `https://redlinelabs.shop/shop`, `https://redlinelabs.shop/products/bpc-157.jpg`, and the Vercel deployment host `redlinelabs-7b6cz9e41-metrouniforms.vercel.app` failed in this environment with TLS error 35 before a status code.
- `npm ci` in this environment failed with `ECONNRESET` while fetching `@neondatabase/serverless` from `registry.npmjs.org`. `npm run check` was not run after that. GitHub CI already passed lint, typecheck, and build for `9f83497`. This branch changes the health report and one overview sentence.

## Build Status

GitHub CI for `9f83497` succeeded: https://github.com/maxcoletta56-web/redlinelabs/actions/runs/40183277525

GitHub recorded production deployment `7311569167` for `9f83497` as successful. This health branch is not a production deploy. Promote it only when explicitly asked.

## Outstanding Work

- Review this branch. Merge only when explicitly asked.
- Leave draft PR #128 unmerged. It records the vial deploy, and it also says to leave #126 unmerged after #126 has already merged.
- Rebase the popup close and the mark-paid sign-up retry from PR #122 onto the current production commit. Leave #122, #119, and #115 unmerged as they stand.
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
- Keep one health report on top. Merging an older health pull request onto a newer production commit leaves the report describing the wrong commit, which is what #126 did.
