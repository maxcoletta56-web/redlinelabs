export const PRODUCT_SLUG_REDIRECTS: Record<string, string> = {
  "products-dsip": "dsip",
  "product-tb-1": "tb-1",
  "products-kisspepien": "kisspeptin",
  "products-slu-pp-322": "slu-pp-332",
  "slu-pp-322": "slu-pp-332",
  "products-nad": "nad-plus",
  "products-ipamorelin": "ipamorelin",
  "products-igf-1": "igf-1",
  "products-ss-31": "ss-31",
  "products-kpv": "kpv",
  "products-glow": "glow",
  "products-klow": "klow",
  "products-pt-141": "pt-141",
  "products-selank": "selank",
  "products-mots-c": "mots-c",
  "products-semax": "semax",
  "product-bacterial-water": "bacterial-water",
  "bac-water": "bacterial-water",
};

export function canonicalProductSlug(slug: string) {
  return PRODUCT_SLUG_REDIRECTS[slug] ?? slug;
}

export function productRedirects() {
  return Object.entries(PRODUCT_SLUG_REDIRECTS).map(([from, to]) => ({
    source: `/product/${from}`,
    destination: `/product/${to}`,
    permanent: true as const,
  }));
}
