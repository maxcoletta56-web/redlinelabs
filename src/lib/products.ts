import catalog from "@/data/products.json";

export type Variant = {
  option: string;
  price: number;
  sku: string;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  categories: string[];
  image: string;
  description: string;
  variantLabel: string | null;
  variants: Variant[];
  minPrice: number;
  maxPrice: number;
  featured: boolean;
};

export const products = catalog as Product[];

export const featuredSlugs = [
  "ghk-cu",
  "retatrutide",
  "cjc-ipamorelin",
  "tesamorelin",
];

export const premiumSlugs = ["bpc-157", "products-nad", "tb-500", "products-glow"];

export function productsBySlugs(slugs: string[]) {
  return slugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is Product => Boolean(p));
}

export type CatalogItem = {
  product: Product;
  variant: Variant | null;
  listingKey: string;
};

export function hasDistinctMgVariants(product: Product) {
  return product.variantLabel === "MG" && product.variants.length > 1;
}

export function displayName(product: Product, variant: Variant | null = product.variants[0] ?? null) {
  const option = variant?.option;
  const unit = product.variantLabel;
  if (!option) return product.name;
  if (unit === "MG") return `${product.name} (${option}mg)`;
  if (unit === "IU" || unit === "Iu") return `${product.name} (${option} IU)`;
  return `${product.name} (${option})`;
}

export function listingPrice(item: CatalogItem) {
  return item.variant?.price ?? item.product.minPrice;
}

export function listingHref(item: CatalogItem) {
  if (item.variant && hasDistinctMgVariants(item.product)) {
    return `/product/${item.product.slug}?option=${encodeURIComponent(item.variant.option)}`;
  }
  return `/product/${item.product.slug}`;
}

export function asCatalogItem(product: Product, variant?: Variant | null): CatalogItem {
  if (variant) {
    return {
      product,
      variant,
      listingKey: hasDistinctMgVariants(product)
        ? `${product.slug}--${variant.option}`
        : product.slug,
    };
  }
  const pinned = product.variants.length === 1 ? product.variants[0] : null;
  return {
    product,
    variant: pinned,
    listingKey: product.slug,
  };
}

export function catalogItems(list: Product[] = products): CatalogItem[] {
  return list.flatMap((product) => {
    if (hasDistinctMgVariants(product)) {
      return product.variants.map((item) => asCatalogItem(product, item));
    }
    return [asCatalogItem(product)];
  });
}

export const categories = [
  "All",
  "GLP-1 RESEARCH",
  "TISSUE RESEARCH",
  "GHRH / GHRELIN RESEARCH",
  "NEUROPEPTIDE RESEARCH",
  "MITOCHONDRIAL RESEARCH",
  "GONADOTROPIN RESEARCH",
  "BLENDS",
  "MELANOCORTIN RESEARCH",
  "LAB SUPPLIES",
] as const;

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function featuredProducts() {
  return catalogItems(productsBySlugs(featuredSlugs));
}

export function premiumProducts() {
  return catalogItems(productsBySlugs(premiumSlugs));
}

export function relatedListings(product: Product, option: string | null = null, limit = 4) {
  const siblings = hasDistinctMgVariants(product)
    ? product.variants
        .filter((variant) => variant.option !== option)
        .map((variant) => asCatalogItem(product, variant))
    : [];
  const others = catalogItems(
    products.filter((item) => item.slug !== product.slug),
  ).sort((a, b) => {
    const aRelated = a.product.categories.some((c) => product.categories.includes(c)) ? 0 : 1;
    const bRelated = b.product.categories.some((c) => product.categories.includes(c)) ? 0 : 1;
    return aRelated - bRelated;
  });
  return [...siblings, ...others].slice(0, limit);
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function priceLabel(product: Product) {
  if (product.minPrice !== product.maxPrice) {
    return `${formatPrice(product.minPrice)} – ${formatPrice(product.maxPrice)}`;
  }
  return formatPrice(product.minPrice);
}
