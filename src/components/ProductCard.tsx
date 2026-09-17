"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { displayName, formatPrice, optionLabel, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const variants = product.variants;
  const hasChoices = variants.length > 1;
  const [option, setOption] = useState(variants[0]?.option ?? "");

  const selected = useMemo(
    () => variants.find((variant) => variant.option === option) ?? variants[0],
    [option, variants],
  );
  const price = selected?.price ?? product.minPrice;
  const category = product.categories[0];
  const title = hasChoices ? product.name : displayName(product);

  return (
    <article className="surface group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#d4af37]/50">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative mb-5 aspect-square overflow-hidden bg-[#0b0b0b]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-contain p-6 transition duration-300 group-hover:scale-[1.03]"
          />
          {selected?.option && (
            <span className="absolute right-3 top-3 border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] tracking-[0.06em] text-[#cfc8b8] uppercase">
              {optionLabel(product, selected.option)}
            </span>
          )}
        </div>
        {category && (
          <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
            {category}
          </p>
        )}
        <h3 className="mb-1 text-[20px] leading-6 font-semibold tracking-[-0.03em] group-hover:text-[#d4af37]">
          {title}
        </h3>
        <p className="mb-3 text-[12px] tracking-[0.04em] text-[#8f8c84] uppercase">
          Research use only · COA on request
        </p>
        <p className="mb-4 text-[22px] font-bold tracking-[-0.03em] text-[#d4af37]">
          {formatPrice(price)}
        </p>
      </Link>
      {hasChoices && (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={`${product.name} options`}>
          {variants.map((variant) => {
            const active = variant.option === selected?.option;
            return (
              <button
                key={variant.option}
                type="button"
                onClick={() => setOption(variant.option)}
                aria-pressed={active}
                className={`border px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase ${
                  active
                    ? "border-[#d4af37] bg-[#d4af37] text-black"
                    : "border-[rgba(212,175,55,0.34)] text-[#cfc8b8] hover:border-[#d4af37] hover:text-[#d4af37]"
                }`}
              >
                {optionLabel(product, variant.option)}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          className="btn flex-1"
          onClick={() =>
            addItem({
              slug: product.slug,
              name: product.name,
              image: product.image,
              option: selected?.option ?? null,
              variantLabel: product.variantLabel,
              price,
            })
          }
        >
          Add to cart
        </button>
        <Link href={`/product/${product.slug}`} className="btn-ghost flex-1">
          View
        </Link>
      </div>
    </article>
  );
}
