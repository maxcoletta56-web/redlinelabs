# Redlinelabs Website Health

Last Updated: 28 September 2026

Overall Status: Production is up to date with `cursor/redlinelabs-shop-1c01` at `b0ee689` (merge of pull request #72, PayID and payment-received emails). GitHub Actions run `36407820646` passed lint, typecheck, and build. GitHub deployment `6707368120` completed as Production success. The default checkout rail is bank transfer. Email is fail-open: a missing `RESEND_API_KEY` logs once and does not fail the order. This environment cannot open a TLS connection to `https://redlinelabs.shop`, so live rendering was not rechecked here.

## Critical Issues

None confirmed on this pass. Checkout still completes when Resend is unset, and the production build of `b0ee689` succeeded.

## High Priority Issues

- Transactional email is now on the production branch, and a green deploy does not prove it sends. Checkout and the mark-paid handler need `RESEND_API_KEY`, `ORDER_EMAIL_FROM` (a verified Resend domain), and a merchant inbox. Names only are in `env.example`. Do not print values.
- `reports/project-overview.md` still told other agents that Payoneer was the only checkout and that the repo had no `vercel.json`. That document is corrected in this change. The sibling health reports under `reports/` are still scaffolds or older than the bank-transfer and email work. Do not re-audit their scopes in this file.
- `npm test` is not part of CI. The mailer suite was added in #72 and was not executed in this environment (`node_modules` is not installed, and the npm registry is not on the egress allow-list).

## Medium Priority Issues

- Merchant mail falls back to `PAYID_ADDRESS` when `ORDER_NOTIFY_EMAIL` is unset. A phone PayID is not an inbox. Set `ORDER_NOTIFY_EMAIL` to the merchant mailbox.
- The customer PayID email and the merchant copy do not include the shipping address. Fulfillment uses the public order page linked from the email. That page is still the access key for name, email, and address.
- `POST /api/admin/orders/[reference]/paid` sends the payment-received email when the order was not already `paid`. If the pre-update lookup fails, or two mark-paid requests overlap, the customer can receive a second payment email. The order status update itself stays idempotent.
- `src/lib/mailer.ts` is not marked `server-only`, so `node:test` can load it. `schedule-email.ts` and `bank-transfer-checkout.ts` are `server-only`. New call sites must stay on the server. The Resend key is read from `RESEND_API_KEY`, not a `NEXT_PUBLIC_` variable.
- Live browser, mobile, and console checks were not repeated. `curl` to `redlinelabs.shop:443` failed with `SSL_ERROR_SYSCALL` in about 60ms, which matches the known egress block and is not a production outage by itself.

## Low Priority Issues

- Dead code still in the tree: root `index.mts` (nothing in the app imports it; it is the only consumer of the `ai` dependency), `src/components/Placeholder.tsx` (no callers), and unused `public/brand/hero.png` and `public/brand/logo.png`. The live brand files are `hero-lab.jpg`, `logo-mark.png`, and `vial.png`.
- Order email is a single gold-on-black table. It does not change the storefront design system.
- Default `public/*.svg` placeholders from the Next.js starter may still be unused.

## Changes Made

- No storefront, checkout, or email code was changed in this pass.
- This report now matches production commit `b0ee689`.
- `reports/project-overview.md` now records bank transfer as the default rail, Payoneer only when `NEXT_PUBLIC_PAYMENTS_PROVIDER=stripe`, `vercel.json` build command, and the Resend variable names.

## Tests Performed

- Reviewed the #72 diff (`d4d99da..b0ee689`): `src/lib/mailer.ts`, `src/lib/schedule-email.ts`, bank-transfer checkout, and the admin mark-paid route. Email failures are caught. A missing Resend key does not change the order result. Logged errors redact `re_` keys and bearer tokens.
- GitHub Actions `36407820646` on `b0ee689`: success (`lint, typecheck, and build`).
- GitHub deployment `6707368120`: Production, state `success`, description "Deployment has completed".
- `curl` to `https://redlinelabs.shop/` , `/shop`, `/checkout`, and `/order/does-not-exist`: TLS failed before HTTP (`SSL_ERROR_SYSCALL`). Not treated as downtime.
- Local `npm run check` and `npm test` were not run. `node_modules` is absent and this VM cannot reach the npm registry.

## Build Status

CI on the production branch passed for `b0ee689`. Vercel production deployment `6707368120` completed successfully. This branch has not been built locally. Production was not redeployed from here; the push that triggered this run is what Vercel already built.

## Outstanding Work

- Confirm in Vercel that `RESEND_API_KEY` and `ORDER_EMAIL_FROM` are set for Production, the sending domain is verified, and `ORDER_NOTIFY_EMAIL` is a real inbox. Do not copy the values into the repo or this report.
- Place one real bank-transfer order on a preview (or production, only when explicitly asked) and confirm the customer PayID email and the merchant copy arrive, then mark it paid and confirm the payment-received email arrives once.
- SEO, catalogue, CRO, QA, and security agents should update their own reports. This pass does not take over those scopes.
- Keep the Redline Labs black and gold storefront. Do not apply a Metro Uniforms redesign. The Vercel project hostname is historical and is not the brand.

## Recommendations

- Leave email fail-open. A Resend outage must not block a customer who can already pay from `/order/[reference]`.
- Do not add `npm test` coverage by disabling the mailer's `.ts` import extensions or by marking `mailer.ts` `server-only`; that combination is what lets the suite load under `node --experimental-strip-types`.
- Add `npm test` to CI in a later change so the mailer suite cannot skip the gate that lint and `tsc` already have.
- Do not merge this notes update to production unless that is what you want published. It does not change the running site.

## Scope / responsibilities

This file is the umbrella for build, deploy, and render health: home, shop, product, cart, checkout, account, policies, header, footer, and error pages. Search and schema belong in `seo-aeo-health.md`. Catalogue data belongs in `catalogue-merchandising-health.md`. Cart and conversion tuning belong in `ecommerce-cro-health.md`. Test budgets belong in `qa-performance-health.md`. Secrets and compliance belong in `security-compliance-health.md`.

## Health checklist

- [x] Production commit `b0ee689` passed CI lint, typecheck, and build.
- [x] Vercel production deployment `6707368120` completed.
- [ ] Live HTTP probe of home, shop, checkout, and a product page. Blocked by egress from this environment.
- [ ] Console and mobile menu rechecked after the email deploy. Not run this pass.
- [ ] Resend production configuration confirmed by a real order email. Not run this pass.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into this scaffold. |
| 2026-09-28 | website health | Recorded the #72 production deploy. No storefront code changes. Corrected the project overview so agents do not treat Payoneer as the default rail. |
