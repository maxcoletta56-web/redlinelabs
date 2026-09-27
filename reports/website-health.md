# Redlinelabs Website Health

Last Updated: 27 September 2026

Overall Status: Production deploy of `59caa08` (merge of pull request #68) completed on Vercel. Checkout now defaults to Australian bank transfer / PayID. GitHub CI (lint, typecheck, build) is green. This environment cannot open a TLS connection to `https://redlinelabs.shop`, so the live checkout configuration was not confirmed. If `PAYID_ADDRESS` and `PAYID_ACCOUNT_NAME` are unset on the Vercel production project, the checkout button stays disabled.

## Critical Issues

- **Confirm the bank-transfer environment before treating checkout as live.** `NEXT_PUBLIC_PAYMENTS_PROVIDER` defaults to `bank_transfer` when unset. Checkout is offered only when `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, and `DATABASE_URL` are all set (`bankTransferConfigured`). The previous production rail was Payoneer. The PayID variables are new. This run could not read Vercel environment values or the live `/api/checkout` response. Until those three names are set, customers cannot place an order. Do not point the flag back at `stripe` to paper over a missing PayID: that flag selects the Payoneer card rail, and pull request #68 switched off that rail because live card charges were blocked.

## High Priority Issues

- **`/order/[reference]` is the payment-instruction page and it is public.** Anyone with the reference sees the customer name, email, shipping address, line items, amount, PayID, and account name. References are six characters from a 32-character alphabet (about 30 bits) so they can be retyped into a transfer description. There is no rate limit on the page. Owned by `security-compliance-health.md`. Do not add an account wall without a replacement way to show payment instructions; this repo still has no transactional email.
- **`POST /api/checkout` does not store a shipping address.** The checkout page uses `startCartCheckoutSession`, which does store shipping. The HTTP route omits it. Owned by `ecommerce-cro-health.md`.
- **`POST /api/checkout` returns the thrown error message to the client.** The server action replaces that with a fixed sentence. A database error on the HTTP route can leak into the JSON body. Owned by `security-compliance-health.md`.
- **Payment instructions are not emailed.** `src/lib/bank-transfer-checkout.ts` records that. The order page tells the customer to bookmark it. Owned by `ecommerce-cro-health.md`.

## Medium Priority Issues

- GitHub Actions runs lint, typecheck, and `next build`. It does not run `npm test`. That is how `account-data.test.ts` stayed red after pull request #62 removed the `.ts` extension Node's test runner needs. The import is restored on this branch.
- `npm test` prints `MODULE_TYPELESS_PACKAGE_JSON` because `package.json` has no `"type": "module"`.
- When bank transfer is not configured, the checkout page tells the customer to add `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, and `DATABASE_URL`. That copy is an operator message on a customer page.
- Catalogue, SEO, and older dead-code notes from 25 September are unchanged and still belong to the sibling reports.

## Low Priority Issues

- Root `index.mts` (only consumer of the `ai` dependency), `src/components/Placeholder.tsx`, default `public/*.svg` files, and unused `public/brand/hero.png` and `public/brand/logo.png` are still unused.
- `SITE_HEALTH.md` still notes Next.js `16.3.4` versus the `16.3.6` ImageResponse advisory. This storefront does not import `next/og`. Bump when the registry is reachable and `npm audit` can run.

## Changes Made

- Order page passes `onceKey={order.reference}` to `ClearCartOnSuccess`. The first visit for that reference still empties the cart and promo code. A later visit, including a bookmark used to check payment status, leaves a newer cart alone. The Payoneer success page still clears on every visit because it has no order key.
- `src/lib/account-data.ts` imports `./variant-label.ts` again so `npm test` can load it. The same extension is already used by `orders.ts` and `comments.ts`, and CI `next build` accepted those.

## Tests Performed

- `node --experimental-strip-types --test src/lib/cart-clear.test.ts src/lib/account-data.test.ts`: 11 passed.
- Full `src/lib/*.test.ts` run in this environment: 68 passed, 3 failed. The failures are `comments.test.ts`, `orders.test.ts`, and `orders-schema.test.ts`, all `ERR_MODULE_NOT_FOUND` for `@neondatabase/serverless`. `npm ci` could not install that package (`ECONNRESET` during TLS). They are not assertion failures.
- GitHub Actions on `59caa08`: lint, typecheck, and build succeeded (run 36327474807).
- Vercel production deployment of `59caa08` completed. Deployment URL was recorded on the GitHub deployment status. A TLS probe of `https://redlinelabs.shop` and of the `vercel.app` host failed in this environment with `SSL_ERROR_SYSCALL`, which matches the earlier network limit. No browser pass was possible here.
- No card payment and no bank transfer was submitted.

## Build Status

The production commit `59caa08` built on GitHub Actions and Vercel. Local `npm ci` failed twice with `ECONNRESET` while downloading `@neondatabase/serverless`, so `npm run lint`, `npm run typecheck`, and `npm run build` could not be run in this environment. GitHub Actions remains the gate for those three. Production was not redeployed by this run. The fix is on a branch for review.

## Outstanding Work

- Set `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, and confirm `DATABASE_URL` on the Vercel production project, then redeploy so the build-time payments flag and the PayID details match. Confirm `GET /api/checkout` returns `configured: true` before calling checkout healthy.
- Set `ADMIN_API_SECRET` before using `GET /api/admin/orders` or `POST /api/admin/orders/[reference]/paid`. Leave it unset to keep those routes closed. Never commit the value.
- Security agent: decide whether the public order page should keep showing email and street address, and whether lookups need a rate limit.
- E-commerce agent: pass shipping through `POST /api/checkout`, and decide how payment instructions are delivered if the customer loses the order URL.
- Add `npm test` to `.github/workflows/ci.yml` so a red unit test cannot merge on a green lint/build.
- Keep the Redline Labs black and gold storefront. Do not apply a Metro Uniforms redesign.

## Recommendations

- Treat a missing PayID configuration as a checkout outage, not as a copy tweak.
- Keep one Neon client (`src/lib/db.ts`). Do not add another.
- Leave the card rail behind `NEXT_PUBLIC_PAYMENTS_PROVIDER=stripe`. Switching it requires a rebuild because the flag is inlined at build time.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-25 | checkout integrity | Merged the 25 September audit into this scaffold. |
| 2026-09-27 | website health | Recorded the bank-transfer production deploy, the unverified PayID configuration, and the order-page cart clear. |
