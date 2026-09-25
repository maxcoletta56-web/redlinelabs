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

Catalogue still points at Jetpack (`i0.wp.com/redlinelabs.shop/wp-content/uploads/…`). `next.config.ts` `images.remotePatterns` allows only that host. Copy files into `/public/products/{slug}.png` and switch `src/data/products.json` `image` fields when egress allows; then drop the remote pattern.

## Analytics

The storefront loads Vercel Analytics and Speed Insights from `/_vercel/insights/script.js` and `/_vercel/speed-insights/script.js` (see `src/components/VercelTelemetry.tsx`). Enable both products on the Vercel project so those endpoints serve scripts in production.

## Pre-deploy checklist

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build` (or `npm run check` for all three)
4. Open `/sitemap.xml` and confirm only current product slugs
5. Open one product page, view source, and paste the `Product` + `BreadcrumbList` JSON-LD into [Google’s Rich Results Test](https://search.google.com/test/rich-results)
6. Run Lighthouse on `/` and one `/product/{slug}` page (Performance, Accessibility, SEO)
7. Keyboard-only pass: shop → product → variant → cart → checkout
8. `npm audit` and review high/critical findings
