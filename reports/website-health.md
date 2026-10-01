# Redlinelabs Website Health

Last Updated: 26 September 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` at `50ed59e` built in GitHub Actions and Vercel reported the deployment complete. Checkout charges through Payoneer and does not deduct browser store credit. A public comments page is now linked from the footer. This environment could not open `https://redlinelabs.shop`, so live HTTP status was not re-checked today. The storefront design system remains Redline Labs black and gold.

## Critical Issues

None confirmed on this pass. The 26 September Vercel status for `50ed59e` is success, and CI (`lint`, `typecheck`, `build`) succeeded. No production outage was observed from here.

## High Priority Issues

- **Public comments are unmoderated.** `50ed59e` (#57) adds `/comments`, a server action that inserts trimmed text into Neon, and a footer link. There is no account, review queue, or removal control. The rate limit is 8 posts per 10 minutes per IP and lives in process memory (`src/lib/rate-limit.ts`), so it does not hold across Vercel isolates. Spam, abuse, or treatment claims can appear on the store. Owner: security-compliance, with website health watching that the route does not take down the rest of the site. The list and insert paths catch database errors and do not throw into the root layout.
- **Comments may not match the database the build prepares.** `npm run build` applies `db/comments.sql` when `DATABASE_URL_UNPOOLED` or `DATABASE_URL` is set (`scripts/ensure-comments-table.mjs`). Runtime `getSql()` in `src/lib/comments.ts` reads only `DATABASE_URL`. If production has the unpooled variable alone, the page will say the database is not configured after a successful schema apply. Not confirmed; Vercel env values were not read.

## Medium Priority Issues

- **Navigation is split.** Header links are Home, Shop, About, FAQ, and Contact. Comments is only in the footer, and `src/app/sitemap.ts` lists `/comments`.
- **The composer is a single-line input** (`Field`, `maxLength` 500) while `TextAreaField` already exists. A 500-character note is hard to review before submit.
- **The comment list has no order or cap.** `SELECT comment FROM comments` has no `ORDER BY` or `LIMIT`. React keys are array indexes, so a changed row order remounts items. The table has no id or timestamp (`comment TEXT` only).
- **`/comments` is dynamic on every request** (`connection()` from `next/server`, then a Neon query). A slow database affects that route only.
- **CI does not run `npm test`.** `.github/workflows/ci.yml` runs lint, typecheck, and build. `src/lib/comments.test.ts` is not part of that job.
- **Live routes were not re-probed.** TLS to `redlinelabs.shop` fails in this environment, and the fetch allowlist blocks that host. The 25 September note that `/product/bacterial-water` returned 404 on production is unverified. Catalogue owns that listing.

## Low Priority Issues

- Placeholder copy on the comment field is `write a comment`.
- The comments table is created both at build time and again on the first request (`CREATE TABLE IF NOT EXISTS`).
- Dead storefront-adjacent files are still in the tree: root `index.mts` (only consumer of the `ai` dependency), `src/components/Placeholder.tsx`, and the default `public/*.svg` assets. `stripeCouponParams` in `src/lib/promo.ts` is covered by tests and is not used by Payoneer checkout.
- `npm ci` in this environment warned that `eslint@9.39.5` is deprecated. The install did not finish (registry TLS reset), so this was not confirmed against a local lint run.

## Changes Made

No storefront code was changed. This pass reviewed `50ed59e` and replaced the 25 September health note, which still described Stripe coupon checkout.

Reviewed surface:

- `src/app/comments/page.tsx`, `comment-form.tsx`, `actions.ts`
- `src/lib/comments.ts`, `src/lib/comments.test.ts`
- Footer link and sitemap entry
- Payoneer checkout still ignores browser store credit (`src/app/checkout/page.tsx`, `src/app/actions/checkout.ts`)
- Age and research-use flags are required by `parseCheckoutBody` before a Payoneer list is created

Left in place: catalogue data, header, black/gold styling, and the comments feature that just shipped. Moderation is a product decision, not a silent removal.

## Tests Performed

- Read the `50ed59e` diff (7 files, comments page plus footer and sitemap).
- GitHub Actions run `36258319166` on `cursor/redlinelabs-shop-1c01`: lint, typecheck, and build succeeded.
- Vercel commit status for `50ed59e`: Deployment has completed (success). Dashboard: `https://vercel.com/metrouniforms/redlinelabs/2fyixY9V3vXVE3epUxsN83nebxqg`
- `npm ci` failed here. `registry.npmjs.org` resets TLS, including the `@neondatabase/serverless` tarball, so `npm test`, `npm run lint`, and `npm run check` were not run locally.
- `curl` to `https://redlinelabs.shop` failed with `SSL_ERROR_SYSCALL`. No browser pass this session.

## Build Status

GitHub Actions production-branch build succeeded on 26 September 2026 for `50ed59e`. Vercel reported that deployment complete. Local `npm run check` did not run. Production was not promoted or redeployed from this session.

## Outstanding Work

- Confirm on a Vercel preview or the live origin that `/comments` saves and lists a comment when `DATABASE_URL` is set, and that a missing URL shows the not-configured message instead of a 500.
- Decide whether public comments stay in the footer. If they stay, add moderation before the list is indexed as store content. Hand the control design to security-compliance; do not duplicate a second comments client.
- Align runtime SQL with the build script’s URL choice (`DATABASE_URL_UNPOOLED` then `DATABASE_URL`) only after checking which name Vercel actually injects. Do not print values.
- Re-probe `/`, `/shop`, `/product/bacterial-water`, `/cart`, and `/checkout` from an environment that can open the live host.
- Add `npm test` to CI so `src/lib/*.test.ts` runs on the production branch.
- Security-compliance and e-commerce reports still need a Payoneer-era pass. Checkout in this tree is Payoneer, not a Stripe coupon. Do not reopen the old store-credit coupon bug.
- SEO owns the new sitemap URL and the lack of extra schema on `/comments`. Catalogue owns product image and slug checks. QA owns the test gap and the dead `index.mts` / `ai` dependency.

## Recommendations

- Keep comments off the primary header until posts are moderated. The footer link is enough for the feature that just shipped.
- Use `TextAreaField` for the comment body when that form is next edited.
- Give stored comments a stable id and a created time before the list grows, then order and limit the select.
- Keep using one Neon access path in the app (`src/lib/comments.ts`) and the existing build-time apply script. Do not add another client.
- Do not deploy or merge to `cursor/redlinelabs-shop-1c01` from a health pass unless asked. This branch is the Vercel production branch.
- Leave the Redline Labs black and gold storefront as it is. A historical branch named `cursor/metro-uniforms-about-151c` is not the current brand.

## Scope

This file is the umbrella health note: build, deploy, core routes, and global chrome. Specialist detail stays in the sibling reports under `reports/`.

## Change log

| Date | Summary |
| --- | --- |
| 2026-09-25 | Merged the first audit into this report. Checkout, security, SEO, catalogue, and test findings were handed to sibling reports. |
| 2026-09-26 | Reviewed the public comments push (`50ed59e`). Recorded CI and Vercel success. Cleared the stale Stripe-coupon checkout note. No storefront code change. |
