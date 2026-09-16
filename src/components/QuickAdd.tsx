"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/products";

export function QuickAdd({ product }: { product: Product }) {
  const { addItem } = useCart();
  const hasChoices = product.variants.length > 1;

  if (hasChoices) {
    return (
      <Link href={`/product/${product.slug}`} className="btn-ghost w-full">
        Select options
      </Link>
    );
  }

  const variant = product.variants[0];
  return (
    <button
      type="button"
      className="btn-ghost w-full"
      onClick={() =>
        addItem({
          slug: product.slug,
          name: product.name,
          image: product.image,
          option: variant?.option ?? null,
          variantLabel: product.variantLabel,
          price: variant?.price ?? product.minPrice,
        })
      }
    >
      Add to cart
    </button>
  );
}
