"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice, optionLabel, type Product } from "@/lib/products";

export function AddToCart({ product }: { product: Product }) {
  const { addItem } = useCart();
  const variants = product.variants;
  const [option, setOption] = useState(variants[0]?.option ?? "");
  const [qty, setQty] = useState(1);

  const selected = useMemo(
    () => variants.find((variant) => variant.option === option) ?? variants[0],
    [option, variants],
  );
  const price = selected?.price ?? product.minPrice;

  return (
    <div className="space-y-5">
      <p className="text-[1.65rem] font-medium tracking-[-0.02em] text-[#d4af37]">
        {formatPrice(price)}
      </p>
      {variants.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
            {product.variantLabel ?? "Option"}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Size">
            {variants.map((variant) => {
              const active = variant.option === selected?.option;
              return (
                <button
                  key={variant.option}
                  type="button"
                  onClick={() => setOption(variant.option)}
                  aria-pressed={active}
                  className={`border px-3 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase ${
                    active
                      ? "border-[#d4af37] bg-[#d4af37] text-black"
                      : "border-[rgba(212,175,55,0.34)] text-[#cfc8b8] hover:border-[#d4af37] hover:text-[#d4af37]"
                  }`}
                >
                  {optionLabel(product, variant.option)} — {formatPrice(variant.price)}
                </button>
              );
            })}
          </div>
        </div>
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
    </div>
  );
}
