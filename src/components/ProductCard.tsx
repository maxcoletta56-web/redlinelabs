import Image from "next/image";
import Link from "next/link";
import { formatPrice, priceLabel, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const hasRange = product.minPrice !== product.maxPrice;
  return (
    <article className="group flex h-full flex-col border border-[rgba(212,175,55,0.16)] bg-[#0a0a0a] p-4 transition duration-300 hover:-translate-y-1 hover:border-[#d4af37] hover:shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
      <Link href={`/product/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative mb-5 aspect-[4/5] overflow-hidden bg-black">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-4 transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
        {product.categories[0] && (
          <p className="mb-2 text-[10px] font-medium tracking-[0.18em] text-[#d4af37] uppercase">
            {product.categories[0]}
          </p>
        )}
        <h3 className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-white uppercase">
          {product.name}
        </h3>
        <p className="mt-auto text-sm font-medium text-[#e6c35c]">
          {hasRange ? priceLabel(product) : formatPrice(product.minPrice)}
        </p>
      </Link>
      <Link
        href={`/product/${product.slug}`}
        className="mt-4 inline-flex items-center justify-center border border-[rgba(212,175,55,0.35)] py-2.5 text-[11px] font-semibold tracking-[0.16em] text-[#d4af37] uppercase transition hover:bg-[#d4af37] hover:text-black"
      >
        {product.variants.length > 1 ? "Select options" : "View details"}
      </Link>
    </article>
  );
}
