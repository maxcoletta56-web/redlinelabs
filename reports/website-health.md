# Redlinelabs Website Health

Last Updated: 29 September 2026

Overall Status: The production branch `cursor/redlinelabs-shop-1c01` is at `08aa732` (admin orders desk, pull request #73). Storefront routes still build. Unsigned visitors to `/admin/orders` get a login form and no order rows. This environment cannot reach `redlinelabs.shop`, so the live deployment of that commit was not observed. Do not promote this branch to production unless explicitly asked.

## Critical Issues

None found in this pass. Checkout, order storage, and the bearer mark-paid route were not broken. No secrets were written into the repo.

## High Priority Issues

- On `08aa732`, marking an order paid from `/admin/orders` updates the row and does not send the payment-received email. `POST /api/admin/orders/[reference]/paid` still sends that email when the order was not already paid. This branch uses one shared function for both, so the desk schedules the same email. It is not on the production branch until this change is reviewed and merged.

## Medium Priority Issues

- The admin login limit is eight failures in fifteen minutes, stored in process memory. A full window on one server instance does not block attempts on another instance. After this change, a full window stops the secret comparison on that instance.
- The desk counts and the “paid today” total use the latest 50 orders. The page already says that.
- Sibling reports still hold the 25 September items that were not re-checked here: catalogue image hosts, product JSON-LD stock values, in-memory accounts, and the public order page showing name, email, and shipping to anyone with the reference.

## Low Priority Issues

- `eslint` warns in `src/app/global-error.tsx` about `window.location.assign()`. The check still exits successfully.
- `npm test` warns that `package.json` has no `"type": "module"`.
- Root `index.mts`, `src/components/Placeholder.tsx`, and the default `public/*.svg` files are still unused.

## Changes Made

- `recordAdminPayment` marks a bank-transfer order paid and schedules the payment-received email unless that order was already paid. The admin desk and the bearer route both call it.
- Admin login checks the rate-limit window before it compares `ADMIN_API_SECRET`. A full window returns the limited message and does not check the secret. A rejected attempt is what fills the window.
- `robots.txt` on this branch already disallows `/admin`. The desk page is `noindex`. Neither change was altered here.

## Tests Performed

- `npm test`: 124 passed, 0 failed. New cases cover “email only when the order was not already paid” and the eight-attempt window.
- `npm run lint`: passed, with the existing `global-error.tsx` warning.
- `npx tsc --noEmit`: passed.
- `npm run build` (Next.js 16.3.4): passed. `/admin/orders` is dynamic. Schema scripts skipped because `DATABASE_URL` is unset.
- `next start` on port 3456: `GET /admin/orders` returned 200 with the login form, a password field, and `noindex`. The HTML did not include “Mark paid” or “Awaiting payment”. The only address in the page was the public footer address `redlinelabsltd@pm.me`. `GET /shop` returned 200. `GET /robots.txt` disallows `/admin`.
- Google Fonts and `redlinelabs.shop` are blocked from this environment. The local build used a font stand-in that is not in the repo. No card payment was submitted, and no order was marked paid against a database.

## Build Status

Local production build succeeded on 29 September 2026. This branch has not been deployed. Production was not updated.

## Outstanding Work

- Review and merge the payment-email fix. Until then, the desk on the production branch stays silent when an order is marked paid.
- Leave `ADMIN_API_SECRET` unset to keep the desk and the bearer routes closed. Do not write the value into the repo or this report.
- Keep the Redline Labs black and gold storefront. Do not apply a Metro Uniforms redesign.
- Use a Vercel preview for this branch. Do not promote it to production without an explicit request.

## Recommendations

- Keep the desk and the bearer route on `recordAdminPayment` so the payment email cannot drift again.
- Hand the admin session cookie (httpOnly, Secure, SameSite strict, path `/admin`, twelve hours, HMAC rather than the raw secret) to `reports/security-compliance-health.md` on the next security pass.
- A shared rate-limit store would make the eight-attempt window hold across server instances. The current in-memory window is still worth keeping.
