import Image from "next/image";
import Link from "next/link";
import { formatPrice, priceLabel, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const hasRange = product.minPrice !== product.maxPrice;
  return (
    <article className="group flex flex-col overflow-hidden rounded-[28px] border border-[#54544e] bg-[#020101] p-4 text-center transition duration-300 hover:-translate-y-1 hover:border-[#d4af37] hover:shadow-[0_0_28px_rgba(212,175,55,0.14)]">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative mx-auto mb-5 aspect-square w-full overflow-hidden rounded-2xl bg-black">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-3 transition duration-500 group-hover:scale-[1.04]"
          />
        </div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-white uppercase">
          {product.name}
        </h3>
        <p className="mb-4 text-sm font-semibold text-[#ffdf00]">
          {hasRange ? priceLabel(product) : formatPrice(product.minPrice)}
        </p>
      </Link>
      <Link
        href={`/product/${product.slug}`}
        className="mt-auto inline-flex items-center justify-center rounded-sm bg-black px-4 py-2.5 text-xs font-medium text-white ring-1 ring-white/10 transition hover:bg-[#d4af37] hover:text-black"
      >
        {product.variants.length > 1 ? "Select options" : "View product"}
      </Link>
    </article>
  );
}
