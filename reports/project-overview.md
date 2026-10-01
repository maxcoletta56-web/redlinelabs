# Redline Labs — Project Overview

> **Purpose:** The single source of truth for the Redline Labs storefront's technical stack,
> architecture, and the safe operating workflow for the multi-agent maintenance system.
> **Every specialist agent must read this file first.** It documents *what* the project is,
> *how* it ships (Cursor ↔ GitHub ↔ Vercel), and the *rules of engagement* that keep changes
> safe and production stable.

---

## 1. What this project is

Redline Labs is a modern, custom-built e-commerce storefront for research chemicals,
serving Australia and deployed at **https://redlinelabs.shop**. It is a rebuild of the
original catalogue as a Next.js application with dark-gold branding, a full product
catalogue, a persistent cart, and bank-transfer checkout (PayID) by default. Set
`NEXT_PUBLIC_PAYMENTS_PROVIDER=stripe` to use the Payoneer hosted card rail instead.
The flag is inlined at build time.

- **Repository:** `github.com/maxcoletta56-web/redlinelabs`
- **Production site:** `https://redlinelabs.shop`
- **Default/production branch:** the repository's remote `HEAD` is
  **`cursor/redlinelabs-shop-1c01`** (there is no `main`/`master`). This is the branch Vercel
  treats as Production; development happens on additional `cursor/*` feature branches that
  merge back into it via PRs. Confirm the current default with
  `git symbolic-ref refs/remotes/origin/HEAD` before relying on it.

---

## 2. Technical stack (as inspected)

| Area | Finding |
| --- | --- |
| **Framework** | Next.js **16.3.4** (App Router, Turbopack), React **19.2.8** |
| **Language** | TypeScript **5** (strict mode) |
| **Styling** | Tailwind CSS **4** via `@tailwindcss/postcss` |
| **Package manager** | **npm** (`package-lock.json`, lockfile v3) — Node **22** |
| **Project structure** | `src/app` (App Router routes), `src/components`, `src/lib` (logic + tests), `src/data/products.json` |
| **Build command** | `npm run build` applies `db/comments.sql` and `db/orders.sql` when a database URL is set, then `next build`. `vercel.json` sets the same `buildCommand`. `npm run check` is lint, `tsc --noEmit`, and that build. |
| **Dev command** | `npm run dev` → `next dev` (serves on `http://localhost:3000`) |
| **Lint** | `npm run lint` → `eslint` (flat config, `eslint-config-next` core-web-vitals + TS) |
| **Tests** | `npm test` → `node --experimental-strip-types --test src/lib/*.test.ts`. CI runs lint, typecheck, and build. CI does not run `npm test`. |
| **Deployment** | **Vercel** (Git-connected Next.js). Production branch is `cursor/redlinelabs-shop-1c01`. |
| **Vercel config** | `vercel.json` sets `buildCommand` to the comments migration, the orders migration, then `next build`. `VERCEL_ENV=production` still selects the live Payoneer API when the card rail is on. |
| **E-commerce platform** | **Custom** — no Shopify/WooCommerce/Medusa. Cart is client-side (localStorage); catalogue is a static JSON file. Bank-transfer orders are stored in Neon (`orders`). |
| **Payment integration** | **Bank transfer / PayID by default.** `NEXT_PUBLIC_PAYMENTS_PROVIDER=stripe` selects Payoneer hosted checkout. Browser store credit is not sent to either rail. |
| **Product data source** | `src/data/products.json` (~**30** products), typed via `src/lib/products.ts` |
| **Analytics** | **None integrated** (no GA4, Vercel Analytics, Plausible, or PostHog). Privacy policy references cookies/analytics generically. AssistLoop is a chat widget, not analytics. |
| **Order email** | Resend HTTP API (`RESEND_API_KEY`, `ORDER_EMAIL_FROM`, `ORDER_NOTIFY_EMAIL`). Sent after the bank-transfer order is stored, and again when an admin marks it paid. Missing key: checkout still succeeds. |
| **SEO implementation** | Next.js Metadata API (global + per-page `generateMetadata`), JSON-LD (`Organization`, `WebSite`+`SearchAction`, per-product `Product`/`Offer`/`AggregateOffer`), dynamic `sitemap.ts`, `robots.ts`, OpenGraph/Twitter cards. Site social images are `src/app/opengraph-image.png` and `src/app/twitter-image.png`. Product pages also pass the catalogue image. |
| **Not part of the storefront** | Root `index.mts` calls the `ai` package (`generateText`). No App Router route imports it. |

### Project structure map

```
/
├── src/
│   ├── app/                # App Router: routes, layouts, API routes, server actions
│   │   ├── layout.tsx      # Root layout, global metadata, Organization/WebSite JSON-LD
│   │   ├── page.tsx        # Home
│   │   ├── shop/           # Catalogue (search / category / sort)
│   │   ├── product/[slug]/ # Product detail (SSG via generateStaticParams)
│   │   ├── cart/ checkout/ account/  # Buying journey + account
│   │   ├── api/checkout/   # Checkout API (bank transfer by default)
│   │   ├── actions/checkout.ts       # Server action entry point
│   │   ├── sitemap.ts robots.ts      # SEO crawl surfaces
│   │   └── <policy pages> # about, faq, contact, privacy, refund, shipping, terms
│   ├── components/         # UI components (Header, Footer, Cart*, Product*, JsonLd, …)
│   ├── lib/                # Business logic + unit tests (*.test.ts)
│   │   ├── products.ts     # Catalogue types/helpers
│   │   ├── bank-transfer-checkout.ts  # PayID orders + scheduled email
│   │   ├── mailer.ts schedule-email.ts  # Resend; fail-open
│   │   ├── cart.tsx        # Cart state (localStorage)     promo*.ts   # Promotions
│   │   ├── checkout-session.ts  # Payoneer session, card rail only
│   │   └── account-data.ts store-credit.ts company.ts …
│   └── data/products.json  # Product catalogue (source of truth)
├── next.config.ts          # Image remotePatterns + redirects
├── eslint.config.mjs tsconfig.json postcss.config.mjs
├── env.example             # Env var NAMES (no values)
└── reports/                # Multi-agent maintenance reports (this directory)
```

### Environment variables (names only — never log values)

Credentials are read from the environment; nothing is hard-coded. `.env*` is
git-ignored. See `env.example` for names. Never log values.

- `NEXT_PUBLIC_PAYMENTS_PROVIDER` — `bank_transfer` (default) or `stripe` (Payoneer card rail). Inlined at build time.
- `PAYID_ADDRESS` / `PAYID_ACCOUNT_NAME` — required for bank transfer. Shown on `/order/[reference]` and in the customer email.
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — Neon. Required to store bank-transfer orders. Build applies the SQL when either is set.
- `RESEND_API_KEY` / `ORDER_EMAIL_FROM` / `ORDER_NOTIFY_EMAIL` — transactional email. Checkout still completes when the key is unset. `ORDER_NOTIFY_EMAIL` falls back to `PAYID_ADDRESS`.
- `ADMIN_API_SECRET` — gates the admin order routes. Leave unset to keep them closed.
- `PAYONEER_MERCHANT_CODE` / `PAYONEER_PAYMENT_TOKEN` — server-only, card rail only.
- `PAYONEER_ENV` — optional `live` or `sandbox`. Production ignores sandbox.
- `NEXT_PUBLIC_SITE_URL` — optional; defaults to `https://redlinelabs.shop`.
- `NEXT_PUBLIC_ASSISTLOOP_AGENT_ID` — optional chat widget.
- `VERCEL_ENV` — injected by Vercel; `production` uses the live Payoneer API when the card rail is selected.

> Browsing, the catalogue, and the cart run without secrets. Bank transfer needs the PayID
> pair and a database URL, and it stays disabled until those are set. The card rail returns
> a clear failure when Payoneer credentials are absent.

---

## 3. How Cursor ↔ GitHub ↔ Vercel interact

This repository ships through a three-party loop. Understanding it is essential before any
agent makes a change.

```
   ┌───────────┐        git push / PR        ┌───────────┐     webhook build/deploy    ┌───────────┐
   │  Cursor   │ ─────────────────────────▶ │  GitHub   │ ─────────────────────────▶ │  Vercel   │
   │ (agents)  │                            │  (source  │                            │ (hosting) │
   │  edit +   │ ◀───────────────────────── │  of truth)│ ◀───────────────────────── │  builds + │
   │  test     │   review comments / status │           │   deploy status / Preview  │  deploys  │
   └───────────┘                            └───────────┘                            └───────────┘
```

1. **Cursor (the agents)** — where code is inspected, edited, and tested. Agents work on a
   VM checkout of the repo, run the local dev server, lint, type-check, tests, and build,
   then commit to a feature branch and push. Agents never edit the production site directly.

2. **GitHub (`maxcoletta56-web/redlinelabs`) — source of truth.** Every change lands as a
   commit on a branch and is reviewed via a Pull Request. Branch history shows the team
   already works this way (numbered PRs from `#29` onward, and many `cursor/*` branches). Merges
   into the default/production branch (`cursor/redlinelabs-shop-1c01`) are the authorization
   signal to deploy.

3. **Vercel — build & host.** Vercel is Git-connected. `vercel.json` runs the Neon schema
   scripts, then `next build`. On every push it builds automatically:
   - **Preview deployments** for each branch/PR — a unique URL where changes are validated
     before merge. In Preview, `VERCEL_ENV` is `preview`, so the card rail does **not** force
     live Payoneer credentials.
   - **Production deployment** when changes reach the production branch — the site is served
     at `https://redlinelabs.shop`. The default rail is bank transfer. `VERCEL_ENV=production`
     uses the live Payoneer API only when `NEXT_PUBLIC_PAYMENTS_PROVIDER=stripe`.

**The golden rule:** production changes only happen by merging to the production branch, and
Vercel deploys automatically from there. Never bypass GitHub. Never deploy to production
without explicit authorization.

---

## 4. Safe workflow for future agents

Follow these steps in order for **every** maintenance task. Do not skip steps.

1. **Read `reports/project-overview.md`** (this file) to understand the stack and pipeline.
2. **Read your specialist health report** (e.g. an SEO task → `reports/seo-aeo-health.md`)
   to understand your remit, key files, and the current baseline.
3. **Inspect current code** relevant to the task before editing. Confirm assumptions against
   the live repository, not memory.
4. **Create/use an appropriate feature or fix branch** — never commit directly to the
   production branch. Use a descriptive branch name (the repo convention is `cursor/<slug>`).
5. **Make scoped changes** — touch only what the task requires. Keep unrelated files
   untouched. Never hard-code or print secrets/env values.
6. **Test locally** — run `npm run dev` and exercise the affected flow end to end.
7. **Run lint/type-check/build where available:**
   ```bash
   npm run lint     # eslint
   npm test         # unit tests
   npm run build    # next build (includes the TypeScript type-check)
   ```
   All three must pass before pushing.
8. **Push changes** to the feature branch (`git push -u origin <branch>`).
9. **Review the Vercel Preview deployment** — open the Preview URL for the PR and verify the
   change renders and behaves correctly in a production-like build.
10. **Only merge/deploy to production when explicitly authorised.** Do not merge the PR,
    enable auto-merge, or promote a deployment on your own initiative.

### Guardrails (always)

- **Do not deploy to production** or merge without explicit authorization.
- **Do not expose secrets** — reference env variables by name only; never echo their values.
- **Do not change unrelated areas** — respect the specialist boundaries defined in the six
  health reports.
- **Update your specialist report** with dated findings and a change-log entry after each run.

---

## 5. The six specialist reports

| Report | Owner agent covers |
| --- | --- |
| `website-health.md` | Overall build/deploy/render health; umbrella for cross-cutting issues |
| `seo-aeo-health.md` | Metadata, structured data, sitemap/robots, AEO answerability |
| `catalogue-merchandising-health.md` | Product data integrity + merchandising surfaces |
| `ecommerce-cro-health.md` | Cart, promotions, bank transfer, Payoneer card rail, conversion |
| `qa-performance-health.md` | Lint/type/test/build gates + Core Web Vitals |
| `security-compliance-health.md` | Secrets, payment safety, dependencies, headers, compliance |

Specialist reports live in `reports/`. The catalogue audit is `reports/catalogue-merchandising-health.md`.

---

## 6. Change log

| Date | Summary |
| --- | --- |
| 2026-09-25 | Overview added in `#38`. |
| 2026-09-25 | Re-checked against `cursor/redlinelabs-shop-1c01` at `0ad846f`. Named the site social images (`src/app/opengraph-image.png`, `src/app/twitter-image.png`). Noted `index.mts` / `ai` sit outside the storefront. Filed the catalogue audit under `reports/` (it had landed at the repo root in `#39`). Image check the same day: 16 of 30 catalogue URLs returned PNG bytes from `i0.wp.com`; 14 returned HTTP 403. |
| 2026-09-26 | Checkout charges through Payoneer hosted payment instead of Stripe. |
| 2026-09-28 | Default rail is bank transfer. Payoneer is the `stripe` provider only. `vercel.json` runs the Neon migrations before `next build`. Resend sends PayID and payment-received email and stays fail-open. |
