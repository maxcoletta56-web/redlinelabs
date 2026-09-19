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

export function optionLabel(product: Pick<Product, "variantLabel">, option: string) {
  const unit = product.variantLabel;
  if (unit === "MG") return `${option} MG`;
  if (unit === "IU" || unit === "Iu") return `${option} IU`;
  return unit ? `${option} ${unit}` : option;
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
  "LAB SUPPLIES",
  "ACCESSORIES",
] as const;

export function isShopCategory(
  value: string | null | undefined,
): value is (typeof categories)[number] {
  return Boolean(value && (categories as readonly string[]).includes(value));
}

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function featuredProducts() {
  return productsBySlugs(featuredSlugs);
}

export function premiumProducts() {
  return productsBySlugs(premiumSlugs);
}

export function relatedProducts(product: Product, limit = 3) {
  return products
    .filter(
      (p) =>
        p.slug !== product.slug &&
        p.categories.some((c) => product.categories.includes(c)),
    )
    .slice(0, limit);
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
