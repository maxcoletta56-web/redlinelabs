# Redlinelabs Website Health

Last Updated: 26 September 2026

Overall Status: Production branch `cursor/redlinelabs-shop-1c01` is `06d4417`. The push that started this pass adds `.cursor/mcp.json` only, so Cursor can call the Whop MCP server at `https://mcp.whop.com/mcp`. Storefront routes, checkout, catalogue data, and the Redline Labs black and gold design are unchanged from `bb25410` (Payoneer checkout, #49). GitHub Actions run `36253647387` (lint, typecheck, and build) succeeded. Vercel reported that deployment complete. This environment cannot open `https://redlinelabs.shop` (`SSL_ERROR_SYSCALL`), so live HTML was not re-checked.

## Critical Issues

None from this push. `.cursor/mcp.json` holds a public MCP URL and no credentials. The Next.js app does not serve that file, and it is not imported by checkout.

## High Priority Issues

- `reports/ecommerce-cro-health.md` and `reports/security-compliance-health.md` still describe Stripe Checkout, `src/app/actions/stripe.ts`, and `src/lib/stripe.ts`. Those paths are gone. Charges are created in `src/app/actions/checkout.ts`, `src/lib/checkout-session.ts`, and `src/lib/payoneer.ts`. Those two reports stay with their owners.
- Live pages were not probed from this environment. The 25 September note that `/product/bacterial-water` returned 404 is older than deploys `17f58ab`, `67f9170`, `266be05`, `bb25410`, and `06d4417`. Do not treat that 404 as a current defect until a probe from a network that can reach the origin.

## Medium Priority Issues

- `src/lib/stripe-keys.ts` is imported only by `src/lib/stripe-keys.test.ts`. `stripeCouponParams` in `src/lib/promo.ts` is used only by `src/lib/promo.test.ts`. Local orders still store `stripeSessionId`. None of these create a Payoneer charge. Cleanup belongs with the e-commerce and QA owners. Do not restore Stripe.
- `POST /api/checkout/notify` returns `{ status: "ok" }` and does not record a payment. Guest checkout address handling is already assigned to `reports/ecommerce-cro-health.md`.

## Low Priority Issues

- The Whop MCP entry is editor configuration. It is not a second payment provider. Do not start a Whop checkout from this file.
- `src/app/global-error.tsx` warns on `window.location.assign("/")` (`@next/next/no-location-assign-relative-destination`). Lint still exits 0. Leave the error page alone unless a follow-up asks to change it.
- Local `next build` in this environment fails while fetching Inter from `fonts.googleapis.com`. That is egress. CI built `06d4417` successfully.

## Changes Made

- Replaced the 25 September Stripe status in this report with the production state at `06d4417`. No storefront code, catalogue, or design changes.

## Tests Performed

- Reviewed `06d4417`: one new file, `.cursor/mcp.json`, eight lines, no secrets.
- Confirmed `src/lib/checkout-session.ts` creates a Payoneer list and does not import Stripe.
- GitHub Actions `36253647387`: success (lint, typecheck, and build).
- Vercel commit status for `06d4417`: deployment has completed.
- `curl -I https://redlinelabs.shop/`: `SSL_ERROR_SYSCALL`. No browser pass.
- Local `npm test`: 43 passed, 0 failed. `npm run lint`: 0 errors, 1 existing warning in `src/app/global-error.tsx`. `npm run typecheck`: passed.
- Local `npm run build`: failed fetching Inter from `fonts.googleapis.com`. Same egress limit as before. CI on `06d4417` already built this storefront.

## Build Status

CI on `06d4417` passed lint, typecheck, and `next build`. Vercel completed the production deployment of that commit. This pass does not deploy anything further.

## Outstanding Work

- E-commerce owner: refresh `reports/ecommerce-cro-health.md` for Payoneer, including the no-op notify route and the unused Stripe helpers.
- Security owner: refresh `reports/security-compliance-health.md` the same way. Credential names are `PAYONEER_MERCHANT_CODE` and `PAYONEER_PAYMENT_TOKEN`.
- Re-check the live footer and `/product/bacterial-water` when this environment can reach `redlinelabs.shop`.
- Leave draft PRs `#22`, `#41`, `#42`, and `#44` alone. Do not open a second Payoneer or store-credit change.

## Recommendations

- Keep Payoneer as the only checkout charge path until a different provider is explicitly requested.
- Keep the Redline Labs black and gold storefront.
- Use a Vercel preview for any later storefront change. Do not promote a deployment from this health pass.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into this scaffold. |
| 2026-09-26 | website health | Recorded the Whop MCP config push and corrected the umbrella status to Payoneer at `06d4417`. |
