import Image from "next/image";
import Link from "next/link";
import { QuickAdd } from "@/components/QuickAdd";
import { displayName, formatPrice, priceLabel, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const hasRange = product.minPrice !== product.maxPrice;
  const option = product.variants[0]?.option;
  const unit = product.variantLabel;
  const category = product.categories[0];

  return (
    <article className="surface group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#d4af37]/50">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative mb-5 aspect-square overflow-hidden rounded-xl bg-[#0b0b0b]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-6 transition duration-300 group-hover:scale-[1.03]"
          />
          {option && (
            <span className="absolute right-3 top-3 border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] tracking-[0.06em] text-[#cfc8b8] uppercase">
              {option}
              {unit === "MG" ? " MG" : unit ? ` ${unit}` : ""}
            </span>
          )}
        </div>
        {category && (
          <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
            {category}
          </p>
        )}
        <h3 className="mb-1 text-[20px] leading-6 font-semibold tracking-[-0.03em] group-hover:text-[#d4af37]">
          {displayName(product)}
        </h3>
        <p className="mb-3 text-[12px] tracking-[0.04em] text-[#8f8c84] uppercase">
          Research use only · COA on request
        </p>
        <p className="mb-5 text-[22px] font-bold tracking-[-0.03em] text-[#d4af37]">
          {hasRange ? priceLabel(product) : formatPrice(product.minPrice)}
        </p>
      </Link>
      <div className="mt-auto flex gap-2">
        <div className="flex-1">
          <QuickAdd product={product} />
        </div>
        <Link href={`/product/${product.slug}`} className="btn-ghost hidden flex-1 sm:inline-flex">
          View
        </Link>
      </div>
    </article>
  );
}
