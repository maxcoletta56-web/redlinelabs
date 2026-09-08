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
      <p className="text-2xl font-semibold text-[#ffdf00]">{formatPrice(price)}</p>
      {variants.length > 0 && (
        <label className="block text-sm">
          <span className="mb-2 block text-xs font-bold tracking-[0.18em] text-[#d4af37] uppercase">
            {product.variantLabel ?? "Option"}
          </span>
          <select
            value={option}
            onChange={(e) => setOption(e.target.value)}
            className="w-full max-w-xs rounded-sm border border-[rgba(212,175,55,0.3)] bg-black px-3 py-3 outline-none focus:border-[#d4af37]"
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
          className="w-20 rounded-sm border border-[rgba(212,175,55,0.3)] bg-black px-3 py-3"
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
          className="rounded-sm bg-[#d4af37] px-8 py-3 text-xs font-bold tracking-[0.18em] text-black uppercase transition hover:bg-[#f6e7b2]"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
