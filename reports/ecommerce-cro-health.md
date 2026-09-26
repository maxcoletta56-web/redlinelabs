# E-commerce & CRO Health Report

> **Purpose:** This report is owned by the **E-commerce & Conversion Rate Optimization (CRO)
> specialist agent**. It tracks the buying journey end to end — cart, promotions, store
> credit, checkout, and the Stripe payment integration — and the friction/conversion levers
> along that path.

## Scope / responsibilities

- Cart mechanics: add/update/remove, persistence (localStorage), drawer + cart page.
- Promo codes and store-credit application logic.
- Checkout form UX: required fields, validation, age/research-use confirmation.
- Stripe embedded checkout session creation and client-secret handling.
- Graceful degradation when Stripe is not configured (dev/preview vs live production).
- Post-purchase surfaces: success page, order capture, COA requests, order history.
- Conversion levers: clarity of pricing, shipping messaging, trust signals, drop-off points.

## Out of scope (see sibling reports)

- Product data correctness → `catalogue-merchandising-health.md`
- Secret handling / PCI posture / key policy → `security-compliance-health.md`
- Raw page availability → `website-health.md`

## Key files & signals

- `src/lib/cart.tsx` — cart state and persistence.
- `src/lib/promo.ts`, `src/lib/promo-state.tsx` — promotions.
- `src/lib/store-credit.ts` — store-credit application.
- `src/lib/checkout-session.ts` — Stripe embedded session (line items, coupons, shipping AU-only).
- `src/app/actions/stripe.ts` — server action entry point.
- `src/app/api/checkout/route.ts`, `src/app/api/checkout/session/route.ts` — checkout API.
- `src/lib/stripe.ts`, `src/lib/stripe-keys.ts` — Stripe client + key resolution/mode.
- `src/components/CartCheckout.tsx`, `src/components/CartDrawer.tsx`, `src/app/checkout/page.tsx`.
- `src/app/checkout/success/page.tsx`, `src/components/CapturePaidOrder.tsx`.

## Health checklist

- [ ] Add-to-cart updates the drawer and cart page; quantities persist across reloads.
- [ ] Promo codes and store credit apply correctly and cannot produce negative totals.
- [ ] Checkout blocks invalid email and un-confirmed age/research-use.
- [ ] With no Stripe keys, checkout returns a clear 503 (no crash).
- [ ] With matching keys, an embedded session returns a client secret.
- [ ] Shipping restricted to AU; currency is AUD throughout.
- [ ] Success page clears the cart and records/captures the order.

## Current status

_Baseline pending first audit._ Checkout uses Stripe **embedded** mode with dynamically
built `price_data` line items and on-the-fly coupons; production enforces **live** keys
(test keys ignored). Cart is client-side. Record conversion friction and defects here per run.

## Change log

| Date | Agent | Summary |
| --- | --- | --- |
| _initial_ | setup | Report scaffold created. |
| 2026-09-26 | checkout | Checkout charges through Payoneer hosted payment (`POST /api/lists`). Stripe is no longer used to take payment. |
