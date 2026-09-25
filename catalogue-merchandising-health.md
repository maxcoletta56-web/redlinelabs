# Catalogue & Merchandising Health Report

Owner: Catalogue & Merchandising. Snapshot of `src/data/products.json` (30 listings) and how that data is shown on the home page, shop, product page, and related-product row.

Out of scope: product structured data (`seo-aeo-health.md`), add-to-cart and checkout conversion (`ecommerce-cro-health.md`), and page-render failures (`website-health.md`).

Checked: unique id / slug / SKU, categories against `src/lib/products.ts`, variant and `minPrice` / `maxPrice` consistency, dose labels in `src/lib/variant-label.ts`, image URLs through the host allowed in `next.config.ts`, AUD formatting, and the featured, premium, related, search, sort, and filter paths.

## Summary

Identity keys are clean: 30 unique ids, 30 unique slugs, 30 unique parent SKUs, and no variant SKU reused on another listing or inside the same listing. Every category string on a product is one of the shop categories, and every shop category has at least one listing. Prices that have variants match `minPrice` / `maxPrice`. `formatPrice` formats whole-dollar amounts as AUD with `en-AU`.

The catalogue is not presentation-complete. Fourteen image URLs fail at the allowed image host, including the featured Tesamorelin card and three of the four premium slugs. Eleven listings publish a price and a parent SKU but an empty `variants` array, so the shop and product page cannot show a dose. The product page always prints the parent SKU, which often is not the SKU of the option on screen. Premium picks are defined and never rendered. Three listings have no related products because they are alone in their category.

## Findings

### Images are missing for 14 listings

`next.config.ts` allows remote images only from `i0.wp.com` under `/redlinelabs.shop/**`. Every catalogue image uses that host with `fit=800,800`. A fetch of each URL returned PNG bytes for 16 listings and HTTP 403 for 14. The 403 body from the image host was `We cannot complete this request, remote data could not be fetched`. `ProductImage` swaps in `/brand/vial.png` after an image error, so those cards and product pages show the generic vial.

Unreachable:

| Slug | Where it is merchandised |
| --- | --- |
| `tesamorelin` | Featured on the home page |
| `products-nad` | Premium slug (not rendered; see below) |
| `products-glow` | Premium slug |
| `tb-500` | Premium slug |
| `products-ipamorelin` | Shop only |
| `tb4` | Shop only |
| `ghk-1200` | Shop only |
| `cjc-1295` | Shop only |
| `products-igf-1` | Shop only |
| `products-ss-31` | Shop only |
| `products-kpv` | Shop only |
| `products-mots-c` | Shop only |
| `products-semax` | Shop only |
| `hcg` | Shop only |

The 16 images that did load are PNG and not square. Measured sizes include 800×533, 600×800, 640×800, 533×800, and 450×800 (`products-slu-pp-322`, `products-selank`). Catalogue and product frames are `aspect-square` with `object-contain`, so these letterbox. The `fit=800,800` query is not what the host returned. Nothing in the catalogue is a tiny file (about 138–241 KB for the files that loaded), but 450px-wide sources will look soft in a large card.

Hero stills for `ghk-cu`, `bpc-157`, and `retatrutide` did load. Local fallbacks `/brand/vial.png` and `/brand/hero-lab.jpg` are in `public/brand/`.

### Eleven listings have no purchasable option

These records have `variants: []`, a null `variantLabel`, and a `minPrice` equal to `maxPrice`. The card and product page still show that price. There is no MG, IU, or form control, and the dose is not in the description either.

`ghk-cu` (featured, and a home hero), `products-slu-pp-322`, `product-tb-1`, `bpc-tb-blend`, `products-kisspepien`, `tb4`, `ghk-1200`, `cjc-1295`, `products-ss-31`, `products-kpv`, `products-pt-141`.

`minPrice` / `maxPrice` only disagree with variant prices in the sense that an empty list has no prices to compare. The stored single price is what the card uses. `src/lib/products.test.ts` requires a parent SKU, image, and description. It does not require a variant.

Where variants exist, dose labelling is consistent with `variant-label.ts`: numeric options (including `5/5`, `10/5`, and `10,000`) take `MG`, `IU`, or `ML`; `Nasal Spray` and `Vial` stay as written. Mixed listings (Selank, Semax, DSIP) use the group label `Option`. Melanotan 2 has `variantLabel: null` and form options only, so it does not gain a false MG suffix. HMG is `75 IU`. HCG is `5000 IU` and `10,000 IU`. Bacterial water is `10 ML`.

### The name on SLU-PP-322 does not match the description

`products-slu-pp-322` is titled **SLU-PP-322**, SKU `Slupp37`. The description identifies the compound as **SLU-PP-332** and then says `(Catalogue name: SLU-PP-322.)`. Shoppers see two names for one listing, and the listing has no variant.

`product-tb-1` (TB-1, SKU `Tb111`, $165, no variant) states that the designation is not standardised and that sequence and identity must be confirmed from batch documents. `ghk-1200` is described as a topical blend (GHK, sodium hyaluronate, panthenol, astaxanthin) with no size option, filed under Tissue Research.

### The SKU on the product page is often not the selected option

`src/app/product/[slug]/page.tsx` prints `product.sku`. Variant buttons show each variant’s own SKU only inside the data, not in that line. Parent SKU differs from every variant SKU on:

| Listing | Parent SKU shown | Variant SKUs |
| --- | --- | --- |
| CJC/Ipamorelin | `Cjcipa` | `Cjcipa55`, `Cjcipa105` |
| NAD+ | `Nad5100` | `Nad500`, `Nad1000` |
| MOTS-C | `Mot-c` | `Motc10`, `Motc20` |
| Semax | `Semax130` | `Semax10`, `Semax30`, `SemaxNS` |
| HCG | `HCGK` | `HCG5K`, `HCG10K` |
| TB-500 | `TB-500` | `Tb512`, `Tb520` |

On other listings the parent SKU is one of the variant SKUs, but not always the first option the page selects. Retatrutide shows `Ret1010` (the 30 MG SKU) while the first option is 10 MG (`Reta10`). DSIP shows `Dsip15` while the first option is 10 MG (`Dsip10`). Epitalon shows `Epi50` while the first option is 10 MG (`Epi10`).

Search (`matchesProductQuery`) includes the parent SKU, name, slug, description, and categories. It does not include variant SKUs or option text, so `SelankNS`, `Dsip10`, or `Nasal Spray` will not match unless those strings already appear in the description.

### Featured works; premium picks are unused; related rows are thin

`featuredSlugs` is `ghk-cu`, `retatrutide`, `cjc-ipamorelin`, `tesamorelin`. Each of those records has `featured: true`, and no other record does. The home page renders `featuredProducts()` in that slug order. `featuredProducts()` reads the slug list, not the boolean, so the two can drift later without a test.

`premiumSlugs` is `bpc-157`, `products-nad`, `tb-500`, `products-glow`. `premiumProducts()` has no caller. Those four listings are not called out on the home page or the shop.

`relatedProducts` keeps catalogue order and takes the first three other listings that share a category. Tissue Research has 12 listings, so early file order fills most of those rows. Three listings get no related row:

| Listing | Category | Count in that category |
| --- | --- | --- |
| Retatrutide | GLP-1 Research | 1 |
| Melanotan 2 | Melanocortin Research | 1 |
| Bacterial Water | Accessories | 1 |

Category counts: Tissue Research 12, Growth Support 6, Brain-Performance 5, Reproductive 4, Energy 3, Blends 2, GLP-1 Research 1, Melanocortin Research 1, Accessories 1. Multi-category listings are CJC/Ipamorelin (Blends, Growth Support), NAD+ (Brain-Performance, Energy), BPC-157/TB-500 blend (Blends, Tissue Research), Kisspeptin (Growth Support, Reproductive), and CJC-1295 (Growth Support, Tissue Research). PT-141 is described as a melanocortin-receptor agonist and is filed only under Reproductive. Melanocortin Research contains only Melanotan 2.

Shop category chips, `isShopCategory`, and the home category grid all use the same `categories` list. Unknown `category` and `sort` query values fall back to All and catalogue order. Sort by price uses `minPrice`, which matches the first variant price on every listing that has variants. Cards show that single price via `formatPrice`. `priceLabel` (the min–max string) is never used, so a card for Retatrutide shows the 10 MG price and not `$100.00 – $245.00`.

### Naming is uneven

Most names are uppercase. Epitalon, Kisspeptin, and Semax are title case, so the grid and the home ticker do not share one style.

Slugs still carry the old `products-` or `product-` prefix on 16 listings (`products-nad`, `product-tb-1`, and others). `products-kisspepien` does not match the name Kisspeptin. Redirects exist only for the old bacterial-water paths (`/product/product-bacterial-water` and `/product/bac-water` → `/product/bacterial-water`).

## What is in good shape

- 30 listings. Unique `id`, `slug`, and parent `sku`. Unique variant SKUs inside each listing and across the file.
- Category strings are a subset of `categories` in `src/lib/products.ts`. No empty category chip.
- For every listing with variants, `minPrice` is the lowest variant price and `maxPrice` is the highest.
- `formatPrice` is `Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })`.
- Dose versus form labelling matches the rules in `src/lib/variant-label.ts`, covered by `src/lib/products.test.ts` for MG versus Nasal Spray.
- Featured slug list and the `featured` flags currently agree. Hero slugs `ghk-cu`, `bpc-157`, and `retatrutide` all resolve.

## Signals to watch

- Image URL returns a PNG from `i0.wp.com` (today 16/30).
- `variants.length > 0` for every listing that should show a dose (today 19/30).
- Parent SKU equals the SKU of the default option, or the product page prints the selected variant SKU.
- `products-slu-pp-322` uses one compound name in the title and the description.
- `premiumProducts()` is either rendered or removed from the merchandising set.
- Singleton categories (GLP-1 Research, Melanocortin Research, Accessories) still have a related-product rule.
- Tests keep covering unique slugs and variant SKUs, and start covering non-empty variants, `minPrice` / `maxPrice`, category membership, and featured-slug resolution.
