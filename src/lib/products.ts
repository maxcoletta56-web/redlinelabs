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

export function displayName(product: Product) {
  const option = product.variants[0]?.option;
  const unit = product.variantLabel;
  if (!option) return product.name;
  if (unit === "MG") return `${product.name} (${option}mg)`;
  if (unit === "IU" || unit === "Iu") return `${product.name} (${option} IU)`;
  return `${product.name} (${option})`;
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
  return productsBySlugs(featuredSlugs);
}

export function premiumProducts() {
  return productsBySlugs(premiumSlugs);
}

export function relatedProducts(product: Product, limit = 4) {
  const same = products.filter(
    (p) =>
      p.slug !== product.slug &&
      p.categories.some((c) => product.categories.includes(c)),
  );
  const rest = products.filter(
    (p) => p.slug !== product.slug && !same.includes(p),
  );
  return [...same, ...rest].slice(0, limit);
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
