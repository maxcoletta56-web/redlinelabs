# Redlinelabs Website Health

Last Updated: 5 October 2026

Overall Status: Healthy enough to stay on the current production deploy. `cursor/redlinelabs-shop-1c01` is at `537546d` (merge of pull request #97, Remember me on account sign-in). GitHub Actions run `37388565464` passed lint, typecheck, and build. Vercel production deployment `6871733746` completed successfully. This environment cannot open a TLS connection to `https://redlinelabs.shop` or to the npm registry, so the sign-in control was reviewed in source and unit-tested locally. It was not clicked on the live site. That TLS failure is not an outage. No checkout or render break was found in the push. The storefront is still Redline Labs black and gold. Default checkout remains bank transfer.

This file is the umbrella health record: build, deploy, and whether the core pages render. Search markup stays in `seo-aeo-health.md`. Catalogue data stays in `catalogue-merchandising-health.md`. Cart and checkout conversion stay in `ecommerce-cro-health.md`. Lint, tests, and Core Web Vitals stay in `qa-performance-health.md`. Secrets and compliance stay in `security-compliance-health.md`.

The copy of this file on the production branch is still the 25 September scaffold. Later health notes, including the 5 October write-up on draft pull request #99 (production at `1758814`), were never merged. Read this report, not the production copy, until one health pull request is merged.

## Critical Issues

None confirmed on this pass.

A green Vercel deploy still does not prove `PAYID_ADDRESS`, `PAYID_ACCOUNT_NAME`, `DATABASE_URL`, or `RESEND_API_KEY` are set. If the PayID or database values are missing, bank-transfer checkout cannot take an order. If the Resend key is missing, the order still saves and the mailer logs once. That is unverified, not a confirmed production failure.

## High Priority Issues

- Unchecked Remember me stores the account email in the client-readable cookie `rl_account_session` (`Path=/`, `SameSite=Lax`, `Secure` on https, no `Max-Age`). The browser sends that email on later same-origin requests, so it can land in request logs. The checked path, which is the default, keeps the sign-in in `localStorage` under `redline-session-v1` and clears the cookie. Accounts remain browser-local. This is a privacy regression on the opt-out path, not a confirmed breach. Security owns the follow-up. Do not rebuild sign-in while that is decided.
- Fourteen catalogue images were last observed returning HTTP 403 from `i0.wp.com` on 25 September 2026, including the featured Tesamorelin card. `ProductImage` then shows `/brand/vial.png`. Detail is in `catalogue-merchandising-health.md`. Image hosts were not fetched again here.
- `reports/project-overview.md` is behind the code. It still says there is no `vercel.json`, that checkout is Payoneer, and that analytics are absent. `vercel.json` sets the build command, the default payments provider is `bank_transfer`, and `VercelTelemetry` loads the Vercel Analytics and Speed Insights scripts. Other agents that trust the overview will redo finished work or change the wrong payment path.
- `reports/seo-aeo-health.md`, `reports/qa-performance-health.md`, `reports/security-compliance-health.md`, and `reports/catalogue-merchandising-health.md` are still the 25 September scaffolds. `reports/ecommerce-cro-health.md` was last edited on 26 September for the Payoneer cutover and does not record bank transfer, the cart continue-shopping links, or the checkout link from pull request #95. Pull request #86 belongs in the SEO report. Pull requests #88, #91, and #95 belong in the CRO report. Pull request #82 belongs in the CRO report as the shared mark-paid receipt, and in the security report only for the admin auth boundary. Pull request #97 belongs in the security report for the session cookie, and in the CRO report only as an account sign-in control. None of those behaviours should be implemented again.

## Medium Priority Issues

- If `rl_account_session` names an email that is not in the browser account list, startup in `src/lib/account.tsx` clears both the cookie and `redline-session-v1`. A cookie wins over a remembered login, so an orphan cookie also drops a still-valid remembered sign-in. The account record in `redline-accounts-v1` is left alone. Security should decide whether an unknown cookie should be ignored instead of wiping the other store.
- The homepage hero (`/brand/hero-lab.jpg`) no longer sets `priority`. The header mark still does. The hero is decorative (`alt=""`), so this may be intentional. QA should confirm it did not move the largest paint to a late image.
- GitHub CI runs lint, typecheck, and build. It does not run `npm test`. The nine Remember me tests in `src/lib/account-session.test.ts` passed locally on this pass and did not run in Actions run `37388565464`.
- Live account sign-in was not exercised after this deploy. The checkbox, the privacy sentence, and the storage helpers were reviewed in source.

## Low Priority Issues

- Creating an account always sets `rememberSession` to true and does not show the checkbox. That matches the old always-persist behaviour. The privacy page only describes the sign-in choice.
- `FaqList` keeps closed answers in the HTML with the `hidden` attribute. Panel ids are `faq-panel-0` and so on, with no page prefix. Each current page renders one list, so ids do not collide today.
- Previously noted unused files are still unused: root `index.mts` (the only `ai` import), `src/components/Placeholder.tsx` (no imports), and the default `public/*.svg` files. They were left in place.
- The test runner still warns that `package.json` has no `"type": "module"` when loading `src/lib/account-session.test.ts`.
- The checkout Continue shopping link uses `mt-4`. The cart page and cart drawer use `mt-3` on the same `btn-ghost w-full` treatment.

## Changes Made

No storefront code was changed in this health pass. Pull request #97 is already on the production branch.

Account sign-in now has a Remember me checkbox, checked by default. Checked sign-ins stay in `localStorage` (`redline-session-v1`) after the browser closes. Unchecked sign-ins use the session cookie `rl_account_session`, which has no `Max-Age` or `Expires`. Signing out clears both stores. A session cookie replaces an older remembered login. Existing remembered values are still a JSON string email, so sessions from before this deploy still read. The privacy page describes that choice. Header, gold and black palette, catalogue data, and payment behaviour were not part of the #97 diff.

The filled-cart checkout summary from pull request #95 still has one `btn-ghost` link to `/shop` labelled “Continue shopping”. It sits outside the payment form and does not clear the cart. The cart page link from #88 and the drawer link from #91 are unchanged. Do not add another.

The admin receipt path from pull request #82 is unchanged: the desk and `POST /api/admin/orders/[reference]/paid` share `markOrderPaidWithPaymentEmail`. There is no `src/lib/record-admin-payment.ts` on `537546d`.

This report supersedes the 5 October write-up on draft pull request #99, which stopped at `1758814`.

Closed since the 25 September write-up, so they should not be reopened as new defects:

- Browser store credit is not sent to the payment rail (pull request #68).
- Guest checkout collects an Australian shipping address (pull request #83).
- `bacterial-water` is in `src/data/products.json`. The 25 September production 404 was a stale deploy.
- The admin desk and the bearer route both schedule the payment-received email (pull request #82).
- Filled cart, cart drawer, and checkout already link back to `/shop` (pull requests #88, #91, and #95).

## Tests Performed

- Reviewed `1758814..537546d`. Five files: `src/app/account/page.tsx`, `src/app/privacy-policy/page.tsx`, `src/lib/account.tsx`, `src/lib/account-session.ts`, and `src/lib/account-session.test.ts`.
- Confirmed the checkbox is inside the sign-in form, `defaultChecked`, and only mounted when the mode is login. `form.get("remember") === "on"` is the only true value passed to `login`.
- Confirmed signup still persists the session and does not show the checkbox.
- `node --experimental-strip-types --test src/lib/account-session.test.ts`: 9 passed, 0 failed. The runner warned that `package.json` has no `"type": "module"`.
- GitHub Actions run `37388565464` on `537546d`: success (`lint, typecheck, and build`).
- Commit status for `537546d`: Vercel context `success`, description "Deployment has completed". GitHub deployment `6871733746` is environment Production, state success, created 5 October 2026.
- `curl` to `https://redlinelabs.shop/account` failed during TLS (`SSL_ERROR_SYSCALL`, exit 35). The account page was not loaded in a browser. `https://registry.npmjs.org` failed the same way, so `npm run check` was not run locally. GitHub Actions remains the build evidence for `537546d`.

## Build Status

The production-branch build for `537546d` succeeded in GitHub Actions, and Vercel reported production deployment `6871733746` complete. This health branch only updates the report. It should not be promoted ahead of the production branch, and it does not need a separate production deploy.

## Outstanding Work

- Security: decide whether the unchecked sign-in cookie should carry an opaque id instead of the email, and whether an unknown cookie should stop wiping a remembered `localStorage` login. Leave `ADMIN_API_SECRET`, PayID values, and `RESEND_API_KEY` out of the repo and this report.
- When egress allows, open `/account` on desktop and at 390px. Sign in with Remember me checked, reload, and confirm the dashboard is still shown. Sign in with it unchecked and confirm the session cookie has no `Max-Age`. Sign out and confirm both stores are cleared. Do not submit a card payment.
- When egress allows, open checkout with a filled cart and confirm “Continue shopping” still lands on `/shop` with the lines still in the cart.
- Confirm PayID, database, and Resend variables exist in Vercel by name only.
- Have the SEO agent write pull request #86 into `seo-aeo-health.md`.
- Have the CRO agent write pull requests #88, #91, #95, and the sign-in checkbox from #97 into `ecommerce-cro-health.md`. The controls already exist. The CRO pass should record them, not add another link or another checkbox.
- Correct `reports/project-overview.md` so the payment provider, `vercel.json`, and analytics match the code.
- Merge one current health report onto the production branch when that merge is explicitly requested, then close the older health drafts (#99, #94, and earlier) so the next agent does not audit from the 25 September scaffold.
- Leave the black and gold storefront as it is.

## Recommendations

- Keep Remember me as the default checked checkbox. Do not add a second session store.
- Keep the session cookie free of `Max-Age` until Security changes the unchecked path. A persistent cookie would undo “the browser drops it when it closes”.
- Keep a single “Continue shopping” link on checkout. The cart page and the cart drawer already have theirs.
- Keep the mark-paid receipt on `markOrderPaidWithPaymentEmail`. Do not add `record-admin-payment.ts` back, and do not merge pull request #80’s copy of that path.
- Keep specialist agents on their own reports. Sign-in persistence from #97 is on production. Another pass should record it, not rebuild it.
- Add `npm test` to CI so `src/lib/account-session.test.ts` runs before a production deploy.
- Treat `reports/project-overview.md` as the architecture source of truth and update it in the same change that switches payments, analytics, or the Vercel build command.
- Do not merge draft pull request #99 after this report. It describes production as `1758814` and would overwrite this #97 note.
