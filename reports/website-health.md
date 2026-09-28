# Redlinelabs Website Health

Last Updated: 28 September 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is at `9a235ca` (merge of pull request #71). GitHub CI passed, and Vercel reported the production deployment of that commit as successful. The change migrates the Neon `orders` table at build time so bank-transfer checkout can insert a `reference`. This environment cannot open `https://redlinelabs.shop`, so a live checkout was not observed after the deploy. No application code was changed in this pass. The storefront brand remains Redline Labs black and gold.

## Critical Issues

None confirmed in this pass.

The last known production checkout failure was `POST /api/checkout` returning 500 because `column "reference" of relation "orders" does not exist`. A Stripe-era `orders` table made `CREATE TABLE IF NOT EXISTS` a no-op. Pull request #71 is the fix for that, and its production deployment completed. Treat checkout as unverified until the build log check in High Priority is done.

## High Priority Issues

- Confirm the Vercel production build log for `9a235ca` prints an `orders table:` column list that includes `reference`. `scripts/ensure-orders-table.mjs` returns success and skips the migration when `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are both unset, so a green build does not by itself prove the table changed. The request path in `src/lib/orders.ts` still runs `CREATE TABLE IF NOT EXISTS` only. That statement will not add `reference` to the old table.
- `reports/project-overview.md` and `reports/ecommerce-cro-health.md` still describe the earlier Payoneer and Stripe embedded checkout. The live default rail is bank transfer (`DEFAULT_PAYMENTS_PROVIDER` in `src/lib/payments-provider.ts`). `vercel.json` sets the build command that runs the orders migration. Specialist agents should read those files against the current tree before editing checkout.

## Medium Priority Issues

- Schema repair for `orders` runs from the build (`package.json` `build` and `vercel.json` `buildCommand`), not from a customer request. A process that inserts orders without that build step can still hit the old table.
- This environment's network allow-list does not include `redlinelabs.shop`, so homepage, cart, checkout, and mobile layout were not opened in a browser on this pass.
- `node --test` still warns that `package.json` has no `"type": "module"` when it loads the TypeScript tests.

## Low Priority Issues

- The temporary Postgres verification workflow on the migration branch failed once, then passed. That harness was removed before merge and is not on `9a235ca`.
- Earlier notes (25 September) called out dead files (`index.mts`, `src/components/Placeholder.tsx`, unused public SVGs) and catalogue image failures. They were not re-checked against this push.

## Changes Made

- Updated this report to the current production head. No storefront, checkout, or schema code was edited.
- The triggering push (already merged as #71) adds `scripts/orders-migration.mjs`, points `scripts/ensure-orders-table.mjs` at it, and covers it with `src/lib/orders-migration.test.ts`. If `public.orders` exists and has no `reference` column, the migration renames it to `orders_legacy_stripe` (or the next free suffix) and creates the table in `db/orders.sql`. It does not drop or truncate rows. A build exits non-zero when `reference` is still missing after the migration and a database URL was set.

## Tests Performed

- `node --experimental-strip-types --test src/lib/orders-migration.test.ts`: 14 passed, 0 failed.
- GitHub Actions run `36404909350` on `9a235ca`: lint, typecheck, and build succeeded (47s).
- `npm run check` was not re-run here. `node_modules` is not installed, and the npm registry is outside this environment's allow-list. The CI run above is the build evidence for this commit.
- No request was sent to production checkout. No browser pass.

## Build Status

- CI on `cursor/redlinelabs-shop-1c01` at `9a235ca`: passed.
- GitHub deployment `6706868725`: environment Production, state success, created 28 September 2026 09:39 UTC. Deployment URL `https://redlinelabs-o0mkn3hcv-metrouniforms.vercel.app`.
- Production was not promoted or redeployed from this session. The merge that triggered this run is what Vercel built.

## Outstanding Work

- Read the production build log and confirm the migration applied. Then place one test order, or inspect a new row, and confirm `POST /api/checkout` no longer returns the missing-`reference` error.
- Bring `reports/project-overview.md` and `reports/ecommerce-cro-health.md` in line with bank transfer, the Neon orders table, and `vercel.json`. Leave catalogue, SEO, security, and performance findings in their own reports.
- Do not merge further changes to `cursor/redlinelabs-shop-1c01` unless that promotion is explicitly requested.

## Recommendations

- Keep using the build as the gate that refuses to ship when `reference` is missing. Do not also rename the live table from a request handler.
- Leave PayID, database URLs, and `ADMIN_API_SECRET` in the host environment. Do not copy them into the repo or this report.
- Keep the Redline Labs black and gold storefront. A branch named for Metro Uniforms is not the current brand.
- Other agents should not re-implement the orders migration. #71 already owns that change.
