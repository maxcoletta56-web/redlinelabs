"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { listingHref, type CatalogItem } from "@/lib/products";

export function QuickAdd({ item }: { item: CatalogItem }) {
  const { addItem } = useCart();
  const { product, variant } = item;

  if (!variant && product.variants.length > 1) {
    return (
      <Link href={listingHref(item)} className="btn-outline w-full">
        Select options
      </Link>
    );
  }

  return (
    <button
      type="button"
      className="btn-outline w-full"
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
