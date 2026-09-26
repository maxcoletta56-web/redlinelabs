import { getProduct, optionLabel, type Product, type Variant } from "./products.ts";

export type CartLineInput = {
  slug: string;
  option?: string | null;
  qty: number;
};

export type ResolvedLine = {
  slug: string;
  name: string;
  option: string | null;
  variantLabel: string | null;
  sku: string;
  qty: number;
  unitAmountCents: number;
};

function selectedVariant(product: Product, option: string | null): Variant | null {
  if (product.variants.length === 0) return null;
  if (option) {
    return product.variants.find((variant) => variant.option === option) ?? null;
  }
  return product.variants[0] ?? null;
}

export function resolveCartLines(input: CartLineInput[]): ResolvedLine[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Cart is empty");
  }

  return input.map((line) => {
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw new Error("Each line needs a quantity between 1 and 99");
    }

    const product = getProduct(line.slug);
    if (!product) {
      throw new Error("A cart item is no longer in the catalogue");
    }

    const option = line.option ?? null;
    const variant = selectedVariant(product, option);
    if (product.variants.length > 0 && !variant) {
      throw new Error(`Choose a valid option for ${product.name}`);
    }

    const dollars = variant?.price ?? product.minPrice;
    if (typeof dollars !== "number" || dollars <= 0) {
      throw new Error(`No price is published for ${product.name}`);
    }

    return {
      slug: product.slug,
      name: product.name,
      option: variant?.option ?? null,
      variantLabel: product.variantLabel,
      sku: variant?.sku || product.sku,
      qty,
      unitAmountCents: Math.round(dollars * 100),
    };
  });
}

export function lineLabel(line: ResolvedLine) {
  if (!line.option) return line.name;
  return `${line.name} (${optionLabel(line, line.option)})`;
}
