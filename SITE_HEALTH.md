# Site health

Operational notes for [redlinelabs.shop](https://redlinelabs.shop). Do not change product copy or prices from this file.

## Canonical host

- Production origin: `https://redlinelabs.shop`
- Code redirects `www.redlinelabs.shop/*` → `https://redlinelabs.shop/:path*` (301 in `next.config.ts`)
- HTTPS is enforced by Vercel. Confirm in the project **Domains** settings:
  1. Add both `redlinelabs.shop` and `www.redlinelabs.shop`
  2. Set `redlinelabs.shop` as the primary domain
  3. Redirect `www` to the apex (not the other way around)
  4. Leave Vercel’s automatic HTTP → HTTPS redirect enabled

## Product slug redirect map

Old WooCommerce-style slugs 301 to kebab-case catalogue slugs. Source of truth: `src/lib/slugs.ts`.

| From | To |
| --- | --- |
| `/product/products-dsip` | `/product/dsip` |
| `/product/product-tb-1` | `/product/tb-1` |
| `/product/products-kisspepien` | `/product/kisspeptin` |
| `/product/products-slu-pp-322` | `/product/slu-pp-332` |
| `/product/slu-pp-322` | `/product/slu-pp-332` |
| `/product/products-nad` | `/product/nad-plus` |
| `/product/products-ipamorelin` | `/product/ipamorelin` |
| `/product/products-igf-1` | `/product/igf-1` |
| `/product/products-ss-31` | `/product/ss-31` |
| `/product/products-kpv` | `/product/kpv` |
| `/product/products-glow` | `/product/glow` |
| `/product/products-klow` | `/product/klow` |
| `/product/products-pt-141` | `/product/pt-141` |
| `/product/products-selank` | `/product/selank` |
| `/product/products-mots-c` | `/product/mots-c` |
| `/product/products-semax` | `/product/semax` |
| `/product/product-bacterial-water` | `/product/bacterial-water` |
| `/product/bac-water` | `/product/bacterial-water` |

TB listings are distinct products and are not redirected into each other: `tb4` (thymosin beta-4), `tb-500` (TB-500 fragment), `tb-1` (separate TB-1 listing), `bpc-tb-blend` (BPC-157 / TB-500 blend).

## Sitemap

`src/app/sitemap.ts` builds `/sitemap.xml` from:

- the public marketing/policy routes listed in that file
- every product in `src/data/products.json` (same source as the shop)

Each URL includes `lastModified`. After a slug rename the sitemap lists only the new slugs; old URLs are 301s, not sitemap entries.

## CSP host list

`Content-Security-Policy-Report-Only` in `next.config.ts` currently allows:

- `'self'`
- Stripe: `https://js.stripe.com`, `https://checkout.stripe.com`, `https://hooks.stripe.com`, `https://api.stripe.com`, `https://m.stripe.network`
- AssistLoop widget: `https://assistloop.ai`
- Vercel Analytics / Speed Insights: `https://va.vercel-scripts.com`, `https://vitals.vercel-insights.com`
- Legacy product images (until all files are local): `https://i0.wp.com`
- `mailto:` form actions for the contact compose flow

Review the report-only console, then promote the header to `Content-Security-Policy` once it is clean.

## Product images

Catalogue still points at Jetpack (`i0.wp.com/redlinelabs.shop/wp-content/uploads/…`). `next.config.ts` `images.remotePatterns` allows only that host. Downloading those files from this environment failed (`i0.wp.com` TLS/egress). Keep the remote pattern. Copy files into `/public/products/{slug}.png` and switch `src/data/products.json` `image` fields when egress allows; then drop the remote pattern.

## Analytics

The storefront loads Vercel Analytics and Speed Insights from `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` (see `src/components/VercelTelemetry.tsx`). Official `@vercel/analytics` and `@vercel/speed-insights` packages could not be installed here (npm registry TLS/egress). Keep the local scripts unless those packages are added in an environment that can reach `registry.npmjs.org`. Enable both products on the Vercel project so those endpoints serve scripts in production.

Checkout validation uses a local schema in `src/lib/validation.ts` for the same reason (`zod` was not installable here).

## Next.js patch level

`package.json` pins `next@16.3.4` / `eslint-config-next@16.3.4`. That line includes the August 2026 Windows RCE and AVIF fixes, but **16.3.4–16.3.5 are affected by the 22 September 2026 `ImageResponse` / Satori RCE** (GHSA-vcvr-r3jv-pc5j). Active LTS patch is `16.3.6`. This storefront does not import `next/og` or `ImageResponse`, so the specific issue is not in the current call graph. Bump `next` and `eslint-config-next` to `16.3.6` when `npm` can reach the registry, and run `npm audit` at the same time.

## Largest client modules

`next build` could not be run in this environment (`node_modules` could not be restored; `registry.npmjs.org` TLS is reset by egress). After a successful build, run `npm run analyze` (`scripts/list-client-chunks.mjs`) and replace this source-level estimate with the real `.next/static/chunks` sizes.

| Rank | Module | Why it is large | Recommendation |
| --- | --- | --- | --- |
| 1 | `@stripe/stripe-js` + `@stripe/react-stripe-js` | Embedded Checkout on `/checkout` via `CartCheckout` | Keep the import only in `CartCheckout`. Optionally `next/dynamic` that component so the checkout chrome paints before Stripe downloads. |
| 2 | Next.js / React runtime | Framework client for every `"use client"` island | Leave as-is. |
| 3 | `src/app/account/page.tsx` (~21 KB source) | Largest app client page (profile, orders, addresses, alerts) | Split orders / addresses / alerts into lazy sections if Lighthouse TBT is high. |
| 4 | `src/app/checkout/page.tsx` (~14 KB source) | Checkout form + totals; pulls Stripe through `CartCheckout` | Already a dedicated route. Do not import `CartCheckout` from the header or cart drawer. |
| 5 | `src/components/Header.tsx` + `CartDrawer` + `src/lib/cart.tsx` | Shared chrome on every page | Leave unless the drawer ships unused checkout helpers. |

`FaqList` is already `next/dynamic` on the homepage. Shop search/sort lives in `ShopCatalog` (client) under a server `shop/page.tsx` + `Suspense` layout.

## Pre-deploy checklist

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build` (or `npm run check` for all three)
4. Open `/sitemap.xml` and confirm only current product slugs
5. Open one product page, view source, and paste the `Product` + `BreadcrumbList` JSON-LD into [Google’s Rich Results Test](https://search.google.com/test/rich-results)
6. Run Lighthouse on `/` and one `/product/{slug}` page (Performance, Accessibility, SEO)
7. Keyboard-only pass: shop → product → variant → cart → checkout
8. `npm audit` and review high/critical findings
