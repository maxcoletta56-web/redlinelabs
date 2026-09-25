# QA & Performance Health Report

> **Purpose:** This report is owned by the **QA & Performance specialist agent**. It tracks code
> quality gates (lint, type-check, unit tests, build) and runtime performance (Core Web
> Vitals, bundle/image weight, rendering strategy) for the Redline Labs storefront.

## Scope / responsibilities

- Automated test suite health (`src/lib/*.test.ts`) and coverage of critical logic.
- Lint (`eslint`) and TypeScript type-checking (via `next build`) passing cleanly.
- Production build success and route rendering strategy (static vs SSG vs dynamic).
- Core Web Vitals: LCP, CLS, INP on key pages.
- Asset weight: image optimization (`next/image`), font loading, JS bundle size.
- Regression prevention: ensuring gates run before merge and on Vercel Previews.

## Out of scope (see sibling reports)

- Feature correctness of catalogue/checkout → respective specialist reports
- Security headers / secret handling → `security-compliance-health.md`

## Commands (canonical gates)

```bash
npm run lint     # eslint (flat config, eslint-config-next)
npm test         # node --experimental-strip-types --test src/lib/*.test.ts
npm run build    # next build — also runs the TypeScript type-check
```

## Key files & signals

- `package.json` — scripts (`dev`, `build`, `start`, `lint`, `test`).
- `eslint.config.mjs` — flat config extending `eslint-config-next` core-web-vitals + TS.
- `tsconfig.json` — strict mode, path aliases, test excludes.
- `src/lib/*.test.ts` — unit tests (currently 31 tests across products, seo, promo,
  store-credit, company, account-data, stripe-keys).
- `next build` output — per-route Static / SSG / Dynamic classification.

## Health checklist

- [ ] `npm run lint` passes with no errors.
- [ ] `npm test` passes (all suites green).
- [ ] `npm run build` succeeds and the TypeScript check passes.
- [ ] No unexpected route moved from Static/SSG to Dynamic.
- [ ] Images use `next/image` with correct `remotePatterns`.
- [ ] Core Web Vitals within budget on home, catalogue, and product pages.

## Current status

_Baseline pending first audit._ On setup: lint passes, **31/31** unit tests pass, and
`next build` succeeds generating **52** routes (home/catalogue/policies static, product
pages SSG via `generateStaticParams`, checkout/api dynamic). Record CWV measurements and
any gate regressions here per run.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
