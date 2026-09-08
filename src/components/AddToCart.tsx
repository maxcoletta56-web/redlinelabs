"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice, type Product } from "@/lib/products";

export function AddToCart({ product }: { product: Product }) {
  const { addItem } = useCart();
  const variants = product.variants;
  const [option, setOption] = useState(variants[0]?.option ?? "");
  const [qty, setQty] = useState(1);

  const selected = useMemo(
    () => variants.find((v) => v.option === option) ?? variants[0],
    [option, variants],
  );
  const price = selected?.price ?? product.minPrice;

  return (
    <div className="space-y-5">
      <p className="font-serif text-3xl font-medium text-[#d4af37]">{formatPrice(price)}</p>
      {variants.length > 0 && (
        <label className="block max-w-xs text-sm">
          <span className="kicker mb-2 block">{product.variantLabel ?? "Option"}</span>
          <select
            value={option}
            onChange={(e) => setOption(e.target.value)}
            className="field"
          >
            {variants.map((variant) => (
              <option key={variant.option} value={variant.option}>
                {variant.option} — {formatPrice(variant.price)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="field w-20"
        />
        <button
          type="button"
          onClick={() =>
            addItem(
              {
                slug: product.slug,
                name: product.name,
                image: product.image,
                option: selected?.option ?? null,
                variantLabel: product.variantLabel,
                price,
              },
              qty,
            )
          }
          className="btn"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
