"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice, type Product } from "@/lib/products";

export function AddToCart({
  product,
  initialOption = null,
}: {
  product: Product;
  initialOption?: string | null;
}) {
  const { addItem } = useCart();
  const variants = product.variants;
  const resolvedOption =
    (initialOption && variants.some((variant) => variant.option === initialOption)
      ? initialOption
      : variants[0]?.option) ?? "";

  const [option, setOption] = useState(resolvedOption);
  const [qty, setQty] = useState(1);

  const selected = useMemo(
    () => variants.find((v) => v.option === option) ?? variants[0],
    [option, variants],
  );
  const price = selected?.price ?? product.minPrice;

  return (
    <div className="space-y-5">
      <p className="text-[1.65rem] font-medium tracking-[-0.02em] text-[#d4af37]">
        {formatPrice(price)}
      </p>
      {variants.length > 0 && (
        <label className="block max-w-xs text-sm">
          <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] uppercase">
            {product.variantLabel ?? "Option"}
          </span>
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
      <div className="flex max-w-md items-end gap-3">
        <label className="block w-20">
          <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] uppercase">
            Qty
          </span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            aria-label="Quantity"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="field w-20"
          />
        </label>
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
          className="btn flex-1"
        >
          Add to cart
        </button>
      </div>
      <p className="text-[12px] tracking-[0.04em] text-[#8f8c84]">
        SKU {selected?.sku || product.sku || "not listed"} · Lot number not published
      </p>
    </div>
  );
}
