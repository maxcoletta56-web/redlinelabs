import Image from "next/image";
import Link from "next/link";
import { QuickAdd } from "@/components/QuickAdd";
import { displayName, formatPrice, priceLabel, type Product } from "@/lib/products";

export function ProductCard({ product }: { product: Product }) {
  const hasRange = product.minPrice !== product.maxPrice;
  const option = product.variants[0]?.option;
  const unit = product.variantLabel;

  return (
    <article className="group flex h-full flex-col">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative mb-4 aspect-square overflow-hidden rounded-xl bg-[#111]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-5 transition duration-300 group-hover:scale-[1.03]"
          />
          {product.categories[0] && (
            <span className="absolute left-3 top-3 rounded bg-[#d4af37] px-2 py-1 text-[10px] font-bold tracking-wide text-black uppercase">
              {product.categories[0].split("/")[0]}
            </span>
          )}
          {option && (
            <span className="absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
              {option}
              {unit === "MG" ? " MG" : unit ? ` ${unit}` : ""}
            </span>
          )}
        </div>
        <h3 className="mb-1 text-[17px] font-semibold text-white">{displayName(product)}</h3>
        <p className="mb-4 text-[17px] font-bold text-white">
          {hasRange ? priceLabel(product) : formatPrice(product.minPrice)}
        </p>
      </Link>
      <div className="mt-auto">
        <QuickAdd product={product} />
      </div>
    </article>
  );
}
