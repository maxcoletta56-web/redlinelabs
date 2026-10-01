# Redlinelabs Website Health

Last Updated: 26 September 2026

Overall Status: The production deployment of `5347da1` (Add @neondatabase/serverless 1.1.0, #55) completed successfully. Checkout on that commit creates a Payoneer list. This environment could not open https://redlinelabs.shop, so page responses were not rechecked here. The design system remains Redline Labs black and gold.

## Critical Issues

None confirmed on this pass. GitHub deployment `6681535691` for `5347da1` is Production and its status is success.

## High Priority Issues

No new customer-facing failure was verified in this pass.

These earlier findings were not re-tested in a browser this session. They stay listed so they are not dropped. The owning report should record the current state.

- Fourteen catalogue image URLs returned HTTP 403 from `i0.wp.com` on 25 September 2026 (`catalogue-merchandising-health.md`).
- `ecommerce-cro-health.md` and `security-compliance-health.md` still describe Stripe as the live payment path. Checkout on this commit uses Payoneer (`src/app/actions/checkout.ts`, `src/lib/payoneer.ts`). Those owners should update their reports so a later pass does not rebuild a Stripe checkout.

## Medium Priority Issues

- `npm run build` and the Vercel build both run `scripts/ensure-comments-table.mjs` before `next build`. When `DATABASE_URL` or `DATABASE_URL_UNPOOLED` is set, that script applies `db/comments.sql` (`CREATE TABLE IF NOT EXISTS comments (comment TEXT)`). A Neon error fails the storefront build. No App Router route reads that table.
- `@neondatabase/serverless` 1.1.0 is in `package.json` and is not imported. The schema script uses `fetch` against Neon’s SQL-over-HTTP endpoint. Leave the package in place; #55 added it on purpose. Do not add a second database client.
- Stripe modules remain after the Payoneer cutover. `src/lib/stripe-keys.ts` is only imported by its test. `stripeCouponParams` in `src/lib/promo.ts` is only imported by `src/lib/promo.test.ts`.

## Low Priority Issues

- `npm run analyze` calls `next build` directly, so it skips the comments schema step.
- `npm test` warns that `package.json` has no `"type": "module"`.
- `npm run lint` reports one warning in `src/app/global-error.tsx`: `window.location.assign()` to an internal path (`@next/next/no-location-assign-relative-destination`). It does not fail lint.
- `.cursor/mcp.json` points Cursor at the Whop MCP server. That file does not affect the storefront runtime.
- Earlier dead-code notes were not rechecked file-by-file this session: root `index.mts` (the only consumer of the `ai` dependency), `src/components/Placeholder.tsx`, default `public/*.svg` files, and unused `public/brand/hero.png` and `public/brand/logo.png`.

## Changes Made

- Refreshed this report against `cursor/redlinelabs-shop-1c01` at `5347da1`.
- Corrected `reports/project-overview.md` so it matches the current build: `vercel.json` sets the build command, the comments schema runs before `next build`, checkout actions live in `src/app/actions/checkout.ts`, and the unit suite is 47 tests. Named `DATABASE_URL` and `DATABASE_URL_UNPOOLED` with no values.

## Tests Performed

- `npm test`: 47 passed, 0 failed. Includes the comments-schema tests and “checkout ignores client-supplied store credit”.
- GitHub Actions on the `5347da1` push: lint, typecheck, and build succeeded (run `36256706031`).
- GitHub deployment `6681535691`: Production, state success. Target `https://redlinelabs-ij90az3tp-metrouniforms.vercel.app`.
- `curl` to https://redlinelabs.shop failed during the TLS handshake (`SSL_ERROR_SYSCALL`). A direct fetch of that host is blocked by this environment’s network allowlist. Page status codes were not collected.
- `npm run lint`: passed, with the existing `global-error.tsx` warning above.
- `npm run typecheck`: passed.
- `npm run build` in this environment: the comments script skipped, then `next build` failed fetching Inter from `fonts.googleapis.com`. That host is blocked here. GitHub Actions on the same commit built successfully.

## Build Status

The production Vercel deployment of `5347da1` completed successfully. GitHub Actions lint, typecheck, and build succeeded on that push. Local `tsc --noEmit` passed. Local `next build` cannot reach Google Fonts from this environment, so it is not a signal about the production build. `DATABASE_URL` is unset here, so the comments script logs a skip and does not contact Neon.

## Outstanding Work

- CRO and security owners should refresh the Stripe sections of their reports.
- Confirm in a browser that home, shop, a product page, cart, and checkout still render on https://redlinelabs.shop. This environment could not complete that request.
- Decide whether applying `db/comments.sql` should keep gating deploys before any storefront feature reads the table.
- Keep `@neondatabase/serverless` until it is clear the #55 follow-up will not use it. If a database client is added, use this package.

## Recommendations

- Move schema changes off the storefront build once a real migration path exists, so a database blip does not block the site.
- Point the next checkout pass at Payoneer.
- Keep the Redline Labs black and gold storefront.

## Scope / responsibilities

This report is the umbrella for build, deploy, and render health: home, catalogue, product, cart, checkout, account, policy pages, global layout, and redirects. Search and structured data, catalogue data, conversion tuning, performance budgets, and secrets belong in the sibling reports named in `reports/project-overview.md`.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into this scaffold. |
| 2026-09-26 | website health | Recorded the successful production deploy of `5347da1`. Noted the unused Neon package, the build-time comments schema, and the stale Stripe write-ups in the sibling reports. |
