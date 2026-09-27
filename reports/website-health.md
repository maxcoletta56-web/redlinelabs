# Redlinelabs Website Health

Last Updated: 27 September 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` at `2a2938c` built in GitHub Actions, and Vercel reported the production deployment complete. Checkout still charges through Payoneer and does not deduct browser store credit. That deploy removed the `.ts` suffix from the `variant-label` import in `src/lib/account-data.ts`, which makes `npm test` fail to load the account suite. This branch puts the suffix back. `tsconfig.json` already sets `allowImportingTsExtensions`, and GitHub Actions already built that import on `50ed59e`. The storefront design system remains Redline Labs black and gold. This environment could not open `https://redlinelabs.shop`, so live HTTP status was not re-checked.

## Critical Issues

None confirmed for the live store. The 27 September Vercel production status for `2a2938c` is success, and CI (`lint`, `typecheck`, `build`) succeeded. No customer-facing outage was observed from here. The account-test failure does not change the running site.

## High Priority Issues

- **Account unit tests do not load on `2a2938c`.** Node's test runner resolves `./variant-label` from `src/lib/account-data.ts` as a file URL and throws `ERR_MODULE_NOT_FOUND`. CI does not run `npm test`, so the merge went out green. This branch restores `./variant-label.ts`. Do not strip `.ts` from modules that `src/lib/*.test.ts` imports. Next.js app files that the test runner never loads (`src/lib/products.ts`, `src/lib/cart.tsx`) can stay extensionless.
- **Public comments are unmoderated.** `/comments` inserts trimmed text into Neon and is linked from the footer. There is no account, review queue, or removal control. The rate limit is 8 posts per 10 minutes per IP and lives in process memory (`src/lib/rate-limit.ts`), so it does not hold across Vercel isolates. Owner: security-compliance. The list and insert paths catch database errors and do not throw into the root layout.
- **Comments may not match the database the build prepares.** `npm run build` applies `db/comments.sql` when `DATABASE_URL_UNPOOLED` or `DATABASE_URL` is set (`scripts/ensure-comments-table.mjs`). Runtime `getSql()` in `src/lib/comments.ts` reads only `DATABASE_URL`. If production has the unpooled variable alone, the page will say the database is not configured after a successful schema apply. Not confirmed; Vercel env values were not read.

## Medium Priority Issues

- **CI does not run `npm test`.** `.github/workflows/ci.yml` runs lint, typecheck, and build. That is why the account import regression reached production. QA owns the workflow change. Do not add a second test script.
- **Navigation is split.** Header links are Home, Shop, About, FAQ, and Contact. Comments is only in the footer, and `src/app/sitemap.ts` lists `/comments`.
- **The composer is a single-line input** (`Field`, `maxLength` 500) while `TextAreaField` already exists.
- **The comment list has no order or cap.** `SELECT comment FROM comments` has no `ORDER BY` or `LIMIT`. React keys are array indexes. The table has no id or timestamp (`comment TEXT` only).
- **`/comments` is dynamic on every request** (`connection()` from `next/server`, then a Neon query). A slow database affects that route only.
- **Live routes were not re-probed.** TLS to `redlinelabs.shop` fails in this environment (`SSL_ERROR_SYSCALL` to `216.150.1.1`), and the fetch allowlist blocks that host. The 25 September note that `/product/bacterial-water` returned 404 is unverified. Catalogue owns that listing.
- **Specialist reports are behind the Payoneer cutover.** `reports/ecommerce-cro-health.md` and `reports/security-compliance-health.md` still describe Stripe checkout. Checkout in this tree is Payoneer. Those files are owned by their agents. This pass does not edit them. Open draft PRs for Whop card checkout (`#53`, `#58`, `#60`, `#61`) were left untouched.

## Low Priority Issues

- Placeholder copy on the comment field is `write a comment`.
- The comments table is created both at build time and again on the first request (`CREATE TABLE IF NOT EXISTS`).
- Dead storefront-adjacent files are still in the tree: root `index.mts` (only consumer of the `ai` dependency), `src/components/Placeholder.tsx`, and the default `public/*.svg` assets. `stripeCouponParams` in `src/lib/promo.ts` is covered by tests and is not used by Payoneer checkout.
- `npm ci` in this environment warned that `eslint@9.39.5` is deprecated. The install did not finish (registry TLS reset on `@neondatabase/serverless`), so lint and `next build` were not run locally.
- `src/lib/comments.test.ts` imports `./comments.ts`, which imports `@neondatabase/serverless` at load time, so those tests could not start without the package.

## Changes Made

Restored the TypeScript extension on the account import:

- `src/lib/account-data.ts` imports `./variant-label.ts` again.

No catalogue, header, colour, checkout, or comments behaviour was changed. Payoneer checkout still ignores browser store credit. `parseCheckoutBody` still requires age and research-use confirmation before a Payoneer list is created.

Earlier unmerged health notes (draft PRs `#48`, `#50`, `#52`, `#56`, `#59`) described the same Payoneer and comments baseline. This file replaces the 25 September note that is still on the production branch.

## Tests Performed

- Confirmed `2a2938c` (merge of `#62`) changes only the account import.
- Loaded `src/lib/account-data.test.ts` against that import: fail, `Cannot find module '/workspace/src/lib/variant-label'`.
- After restoring the `.ts` suffix, `node --experimental-strip-types --test` passed 43 tests across account, company, payoneer, products, promo, seo, slugs, store-credit, stripe-keys, and validation.
- `src/lib/comments-schema.test.ts`: 4 passed.
- `src/lib/comments.test.ts`: not run. The Neon package is not installed here.
- GitHub Actions run `36319085400` on `cursor/redlinelabs-shop-1c01` for `2a2938c`: lint, typecheck, and build succeeded.
- The same CI job on `50ed59e` (run `36258319166`) already succeeded with `./variant-label.ts` present.
- Vercel production deployment `6692185731` for `2a2938c`: success. Preview deployment `6692176086` for the import removal also succeeded.
- `npm ci` failed twice. `registry.npmjs.org` resets TLS on the Neon tarball, so `npm run lint`, `npm run typecheck`, and `npm run check` were not run locally.
- `curl` to `https://redlinelabs.shop` failed during the TLS handshake. No browser pass this session.

## Build Status

GitHub Actions and Vercel both succeeded for production commit `2a2938c` on 27 September 2026. Local `npm run check` did not run. This session did not deploy or promote anything. The restored import matches the tree CI already built on `50ed59e`.

## Outstanding Work

- Merge this branch only through review. Do not push it onto `cursor/redlinelabs-shop-1c01` from a health pass.
- Add `npm test` to CI so an extensionless import cannot ship again. QA owns `.github/workflows/ci.yml`.
- Confirm on a Vercel preview or the live origin that `/comments` saves and lists a comment when `DATABASE_URL` is set, and that a missing URL shows the not-configured message instead of a 500.
- Decide whether public comments stay in the footer. If they stay, add moderation before the list is indexed as store content. Hand the control design to security-compliance.
- Align runtime SQL with the build script’s URL choice only after checking which name Vercel injects. Do not print values.
- Re-probe `/`, `/shop`, `/product/bacterial-water`, `/cart`, `/checkout`, and `/comments` from an environment that can open the live host.
- Ask the e-commerce and security agents to refresh their reports for Payoneer. Do not reopen the old Stripe store-credit coupon bug.
- SEO owns the `/comments` sitemap URL. Catalogue owns product images and slugs. Leave the open Whop checkout drafts to that work.

## Recommendations

- Keep `.ts` extensions on any module imported by `node --experimental-strip-types --test`. `#30` turned `allowImportingTsExtensions` on so Vercel typecheck accepts that style.
- Keep comments off the primary header until posts are moderated.
- Use the existing `TextAreaField` when the comment form is next edited.
- Give stored comments a stable id and a created time before the list grows, then order and limit the select.
- Keep one Neon access path (`src/lib/comments.ts`) and the existing build-time apply script.
- Leave the Redline Labs black and gold storefront as it is. A historical branch named `cursor/metro-uniforms-about-151c` is not the current brand.

## Scope

This file is the umbrella health note: build, deploy, core routes, and global chrome. Specialist detail stays in the sibling reports under `reports/`.

## Change log

| Date | Summary |
| --- | --- |
| 2026-09-25 | Merged the first audit into this report. Checkout, security, SEO, catalogue, and test findings were handed to sibling reports. |
| 2026-09-26 | Reviewed the public comments push (`50ed59e`) in an unmerged draft. Cleared the stale Stripe-coupon checkout note. |
| 2026-09-27 | Reviewed `#62` (`2a2938c`). CI and the Vercel production deploy succeeded. Restored `./variant-label.ts` so the account tests load. No storefront redesign. |
