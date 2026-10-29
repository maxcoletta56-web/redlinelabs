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
catalogue, a persistent cart, PayID bank transfer, PayPal card checkout beside PayID
when those credentials exist, a one-time Redline Club sign-up, and a separate
distribution login for box quotes.

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
| **Build command** | `npm run build` runs the comments, orders, club, and distribution schema scripts, then `next build` (which also type-checks). `vercel.json` `buildCommand` currently runs the comments and orders scripts only. |
| **Dev command** | `npm run dev` → `next dev` (serves on `http://localhost:3000`) |
| **Lint** | `npm run lint` → `eslint` (flat config, `eslint-config-next` core-web-vitals + TS) |
| **Tests** | `npm test` → `node --experimental-strip-types --test src/lib/*.test.ts`. CI does not run this script. |
| **Deployment** | **Vercel** (Git-connected, zero-config Next.js preset) |
| **Vercel config** | `vercel.json` sets `buildCommand`. `VERCEL_ENV=production` uses the live PayPal API. `VercelTelemetry` loads Vercel Web Analytics and Speed Insights. |
| **E-commerce platform** | **Custom** — no Shopify/WooCommerce/Medusa. Cart is client-side (localStorage); catalogue is a static JSON file. Distribution quotes are separate DQ references, not shop orders. |
| **Payment integration** | **PayID / bank transfer** is the default rail and stores an unpaid order, then shows the reference on `/order/[reference]`. **PayPal** guest card checkout is offered beside PayID when `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set. `NEXT_PUBLIC_PAYMENTS_PROVIDER=bank_transfer_only` hides PayPal. |
| **Product data source** | `src/data/products.json` (~**30** products), typed via `src/lib/products.ts`. Photos are local 1024×1024 JPEGs. Numeric strengths sit in a gold double rule on the shared vial. Listings with no numeric option show the name only. |
| **Analytics** | `VercelTelemetry` injects `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js`. No GA4, Plausible, or PostHog. AssistLoop is a chat widget, not analytics. |
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
│   │   ├── distribution/   # Separate login, applications, and DQ box quotes
│   │   ├── admin/orders/ admin/distribution/  # Signed-in desks
│   │   ├── api/checkout/   # Checkout API (PayID, with PayPal when configured)
│   │   ├── actions/checkout.ts       # Checkout server action
│   │   ├── sitemap.ts robots.ts      # SEO crawl surfaces
│   │   └── <policy pages> # about, faq, contact, privacy, refund, shipping, terms
│   ├── components/         # UI components (Header, Footer, Cart*, Product*, JsonLd, …)
│   ├── lib/                # Business logic + unit tests (*.test.ts)
│   │   ├── products.ts     # Catalogue types/helpers      paypal.ts   # PayPal order + card checkout
│   │   ├── cart.tsx        # Cart state (localStorage)     promo*.ts   # Promotions
│   │   ├── checkout-session.ts  # Checkout session          seo.ts     # SEO helpers
│   │   └── account-data.ts store-credit.ts company.ts …
│   └── data/products.json  # Product catalogue (source of truth)
├── next.config.ts          # Image remotePatterns + redirects
├── eslint.config.mjs tsconfig.json postcss.config.mjs
├── env.example             # Env var NAMES (no values)
└── reports/                # Multi-agent maintenance reports (this directory)
```

### Environment variables (names only — never log values)

Credentials are read from the environment; nothing is hard-coded. `.env*` is
git-ignored. See `reports/security-compliance-health.md` for the full table.
Names only — never log values.

- `PAYID_ADDRESS` / `PAYID_ACCOUNT_NAME` — shown on the bank-transfer order page. Checkout stays disabled until they are set.
- `DATABASE_URL` — Neon connection used for comments, orders, the club, and distribution.
- `ADMIN_API_SECRET` — gates the admin order routes and both desks. Also signs distribution sessions when `DISTRIBUTION_SESSION_SECRET` is unset. Leave it unset to keep the desks closed.
- `DISTRIBUTION_SESSION_SECRET` — signs the distribution login cookie. At least 16 characters.
- `CLUB_CODE_SECRET` — HMAC key for Redline Club member codes. Join fails closed while it is unset.
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` — server-only PayPal REST credentials. PayPal is offered beside PayID when both are set.
- `PAYPAL_ENV` — optional `live` or `sandbox`. Production ignores sandbox.
- `NEXT_PUBLIC_PAYMENTS_PROVIDER` — unset, `bank_transfer`, and `paypal` still offer PayPal when the secrets exist. `bank_transfer_only` hides it.
- `RESEND_API_KEY` / `ORDER_EMAIL_FROM` / `ORDER_NOTIFY_EMAIL` — order mail. A missing key logs once and sends nothing.
- `NEXT_PUBLIC_SITE_URL` — optional; defaults to `https://redlinelabs.shop`.
- `NEXT_PUBLIC_ASSISTLOOP_AGENT_ID` — optional chat widget.
- `VERCEL_ENV` — injected by Vercel; `production` uses the live PayPal API.

> The app runs **without any secrets** for browsing and the catalogue. Bank-transfer checkout
> needs PayID and the database. PayPal degrades to PayID-only when its credentials are absent.
> Distribution sign-in needs a session secret and the database. `DISTRIBUTION_DEV_STORE=1`
> is ignored in production.

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

3. **Vercel — build & host.** Vercel is Git-connected. `vercel.json` overrides the build
   command. On every push it builds automatically:
   - **Preview deployments** for each branch/PR — a unique URL where changes are validated
     before merge. In Preview, `VERCEL_ENV` is `preview`, so the app does **not** force live
     PayPal credentials.
   - **Production deployment** when changes reach the production branch — `VERCEL_ENV` is
     `production`, which makes the app use the **live** PayPal API and serve
     `https://redlinelabs.shop`.

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
| `ecommerce-cro-health.md` | Cart, promotions, checkout, PayID and PayPal, conversion |
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
| 2026-10-25 | Corrected this overview for production at `72ef9e3`: PayID by default, PayPal beside it, Redline Club $15 sign-up, distribution login, `vercel.json`, and `VercelTelemetry`. The 26 September Payoneer row is historical. |
| 2026-10-29 | Re-checked against `e141d97`. Catalogue strengths use the gold double rule on the shared vial. The architecture in this file is unchanged. |
