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
catalogue, a persistent cart, and Payoneer Checkout.

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
| **Build command** | `npm run build` → `next build` (also runs the TypeScript type-check) |
| **Dev command** | `npm run dev` → `next dev` (serves on `http://localhost:3000`) |
| **Lint** | `npm run lint` → `eslint` (flat config, `eslint-config-next` core-web-vitals + TS) |
| **Tests** | `npm test` → `node --experimental-strip-types --test src/lib/*.test.ts` (**31** tests) |
| **Deployment** | **Vercel** (Git-connected, zero-config Next.js preset) |
| **Vercel config** | No `vercel.json` — relies on Vercel's automatic Next.js framework detection. `VERCEL_ENV` is consumed by the app to use the live Payoneer API in production. |
| **E-commerce platform** | **Custom** — no Shopify/WooCommerce/Medusa. Cart is client-side (localStorage); catalogue is a static JSON file. |
| **Payment integration** | **Payoneer Checkout** — server creates a LIST (`POST /api/lists`) and redirects to the hosted payment page. Live API in production. |
| **Product data source** | `src/data/products.json` (~**30** products), typed via `src/lib/products.ts` |
| **Analytics** | **None integrated** (no GA4, Vercel Analytics, Plausible, or PostHog). Privacy policy references cookies/analytics generically. AssistLoop is a chat widget, not analytics. |
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
│   │   ├── api/checkout/   # Checkout API (Payoneer list)
│   │   ├── actions/stripe.ts         # Server action entry point
│   │   ├── sitemap.ts robots.ts      # SEO crawl surfaces
│   │   └── <policy pages> # about, faq, contact, privacy, refund, shipping, terms
│   ├── components/         # UI components (Header, Footer, Cart*, Product*, JsonLd, …)
│   ├── lib/                # Business logic + unit tests (*.test.ts)
│   │   ├── products.ts     # Catalogue types/helpers      payoneer.ts # Payoneer list + hosted page
│   │   ├── cart.tsx        # Cart state (localStorage)     promo*.ts   # Promotions
│   │   ├── checkout-session.ts  # Payoneer checkout session seo.ts     # SEO helpers
│   │   └── account-data.ts store-credit.ts company.ts …
│   └── data/products.json  # Product catalogue (source of truth)
├── next.config.ts          # Image remotePatterns + redirects
├── eslint.config.mjs tsconfig.json postcss.config.mjs
├── env.example             # Env var NAMES (no values)
└── reports/                # Multi-agent maintenance reports (this directory)
```

### Environment variables (names only — never log values)

Payoneer credentials are read from the environment; nothing is hard-coded. `.env*` is
git-ignored. See `reports/security-compliance-health.md` for the full table.

- `PAYONEER_MERCHANT_CODE` / `PAYONEER_PAYMENT_TOKEN` — server-only Payoneer Checkout credentials.
- `PAYONEER_ENV` — optional `live` or `sandbox`. Production ignores sandbox.
- `NEXT_PUBLIC_SITE_URL` — optional; defaults to `https://redlinelabs.shop`.
- `NEXT_PUBLIC_ASSISTLOOP_AGENT_ID` — optional chat widget.
- `VERCEL_ENV` — injected by Vercel; `production` uses the live Payoneer API.

> The app runs **without any secrets** for browsing/catalogue/cart. Only Payoneer checkout
> requires credentials, and it **degrades gracefully to a 503** when they are absent.

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

3. **Vercel — build & host.** Vercel is Git-connected with the zero-config Next.js preset
   (no `vercel.json`). On every push it builds automatically:
   - **Preview deployments** for each branch/PR — a unique URL where changes are validated
     before merge. In Preview, `VERCEL_ENV` is `preview`, so the app does **not** force live
     Payoneer credentials.
   - **Production deployment** when changes reach the production branch — `VERCEL_ENV` is
     `production`, which makes the app use the **live** Payoneer API and serve
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
| `ecommerce-cro-health.md` | Cart, promotions, checkout, Payoneer, conversion |
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
