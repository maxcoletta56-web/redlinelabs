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

export const categories = [
  "All",
  "GLP-1/FAT LOSS",
  "HEALING/COLLAGEN",
  "GH SECRETAGOGUES",
  "COGNITIVE/FOCUS",
  "MITOCHONDRIA/ENERGY",
  "LIBIDO/HCG",
  "BLENDS",
  "TANNING",
] as const;

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function featuredProducts() {
  return featuredSlugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is Product => Boolean(p));
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
