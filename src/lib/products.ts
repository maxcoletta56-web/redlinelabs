import catalog from "../data/products.json" with { type: "json" };
import { canonicalProductSlug } from "./slugs.ts";
import { isDoseOption, optionLabel, variantGroupLabel } from "./variant-label.ts";

export { isDoseOption, optionLabel, variantGroupLabel };

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
  lotNumber?: string | null;
  coaUrl?: string | null;
};

export const products = catalog as Product[];

export const featuredSlugs = [
  "ghk-cu",
  "retatrutide",
  "cjc-ipamorelin",
  "tesamorelin",
];

export const premiumSlugs = ["bpc-157", "nad-plus", "tb-500", "glow"];

export function productsBySlugs(slugs: string[]) {
  return slugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is Product => Boolean(p));
}

export function displayName(product: Product, selectedOption?: string) {
  const option = selectedOption ?? product.variants[0]?.option;
  if (!option) return product.name;
  return `${product.name} (${optionLabel(product, option)})`;
}

export const categories = [
  "All",
  "GLP-1 RESEARCH",
  "TISSUE RESEARCH",
  "GROWTH SUPPORT",
  "BRAIN-PERFORMANCE",
  "ENERGY",
  "REPRODUCTIVE",
  "BLENDS",
  "MELANOCORTIN RESEARCH",
  "ACCESSORIES",
] as const;

export function isShopCategory(
  value: string | null | undefined,
): value is (typeof categories)[number] {
  return Boolean(value && (categories as readonly string[]).includes(value));
}

export function getProduct(slug: string) {
  const canonical = canonicalProductSlug(slug);
  return products.find((p) => p.slug === canonical);
}

export function matchesProductQuery(product: Product, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = [
    product.name,
    product.sku,
    product.slug.replaceAll("-", " "),
    product.description,
    ...product.categories,
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function featuredProducts() {
  return productsBySlugs(featuredSlugs);
}

export function premiumProducts() {
  return productsBySlugs(premiumSlugs);
}

export function relatedProducts(product: Product, limit = 3) {
  const seen = new Set<string>([product.slug]);
  const related: Product[] = [];
  for (const candidate of products) {
    if (seen.has(candidate.slug)) continue;
    if (!candidate.categories.some((category) => product.categories.includes(category))) {
      continue;
    }
    seen.add(candidate.slug);
    related.push(candidate);
    if (related.length >= limit) break;
  }
  return related;
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
