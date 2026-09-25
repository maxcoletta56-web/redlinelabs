# Security & Compliance Health Report

> **Purpose:** This report is owned by the **Security & Compliance specialist agent**. It tracks
> secret handling, payment-integration safety, dependency risk, HTTP/security headers, and
> the regulatory/compliance posture appropriate to a research-chemical storefront selling
> into Australia.

> **Handling rule:** Never print, commit, or paste environment variable *values* or secrets in
> this report, in code, in logs, or in chat. Reference variables by **name** only.

## Scope / responsibilities

- Secret hygiene: Stripe keys and other env vars are read from the environment, never
  hard-coded or committed. `.env*` remains git-ignored.
- Payment safety: live-key enforcement in production, no secret keys reaching the client,
  correct split between `NEXT_PUBLIC_*` (client) and server-only values.
- `server-only` boundaries around modules that touch the Stripe secret key.
- Dependency vulnerabilities (`npm audit`) and supply-chain hygiene.
- Security headers, CSP, and safe handling of third-party scripts (AssistLoop, Stripe.js).
- Compliance content: research-use-only disclaimers, age confirmation, privacy/refund/terms,
  and correct legal entity details.

## Out of scope (see sibling reports)

- Checkout conversion UX → `ecommerce-cro-health.md`
- Test/build gates → `qa-performance-health.md`

## Environment variables (names only — never log values)

| Variable | Surface | Required | Notes |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` (or `REDLINE_STRIPE_SECRET_KEY`) | Server | For checkout | Secret; never client-exposed. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (and aliases) | Client | For checkout | Publishable key. |
| `NEXT_PUBLIC_SITE_URL` | Client/Server | Optional | Defaults to `https://redlinelabs.shop`. |
| `NEXT_PUBLIC_ASSISTLOOP_AGENT_ID` | Client | Optional | Enables chat widget when set. |
| `STRIPE_REQUIRE_LIVE` | Server | Optional | Force live-only key enforcement. |
| `VERCEL_ENV` | Server | Provided by Vercel | `production` triggers live-key enforcement. |

## Key files & signals

- `src/lib/stripe-keys.ts` — key resolution, live/test mode selection, `shouldRequireLiveKeys`.
- `src/lib/stripe.ts` — `server-only` Stripe client (throws if unconfigured).
- `src/app/api/checkout/route.ts` — 503 when not configured; input validation.
- `.gitignore` — confirms `.env*` and build artefacts are ignored.
- `env.example` — documents variable names (no values).
- `src/lib/company.ts` — legal entity details used in disclosures.
- Policy pages: `privacy-policy`, `refund-policy`, `terms-of-service`, `shipping-policy`.

## Health checklist

- [ ] No secret values committed anywhere in the repo or logs.
- [ ] `.env*` is git-ignored and no real `.env` is tracked.
- [ ] Secret keys are only referenced in `server-only` modules.
- [ ] Production enforces live Stripe keys; test keys are ignored.
- [ ] `npm audit` reviewed; no unaddressed high/critical vulnerabilities.
- [ ] Third-party scripts loaded from expected origins only (Stripe.js, AssistLoop).
- [ ] Research-use-only + age confirmation present in checkout and product surfaces.
- [ ] Legal entity, privacy, refund, and terms content present and accurate.

## Current status

_Baseline pending first audit._ On setup: `.env*` is git-ignored, Stripe secret access is
behind `server-only`, key resolution rejects live/test mismatches and enforces live keys in
production, and checkout degrades to a 503 without keys. Record `npm audit` results and
header/CSP posture here per run.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
