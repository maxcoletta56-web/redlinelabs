import { ProductImage } from "@/components/ProductImage";
import Link from "next/link";
import { QuickAdd } from "@/components/QuickAdd";
import {
  displayName,
  formatPrice,
  listingHref,
  listingPrice,
  priceLabel,
  type CatalogItem,
} from "@/lib/products";

export function ProductCard({ item }: { item: CatalogItem }) {
  const { product, variant } = item;
  const unit = product.variantLabel;
  const category = product.categories[0]?.split("/")[0];
  const option = variant?.option;
  const price = variant ? formatPrice(listingPrice(item)) : priceLabel(product);

  return (
    <article className="group flex h-full flex-col">
      <Link href={listingHref(item)} className="block">
        <div className="surface relative mb-4 aspect-square overflow-hidden">
          <ProductImage
            src={product.image}
            alt={displayName(product, variant)}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-contain p-6 transition duration-300 group-hover:scale-[1.02]"
          />
          {option && (
            <span className="absolute right-3 top-3 border border-white/10 bg-black/70 px-2 py-1 text-[10px] tracking-[0.06em] text-[#cfc8b8] uppercase">
              {option}
              {unit === "MG" ? " MG" : unit ? ` ${unit}` : ""}
            </span>
          )}
        </div>
        {category && <p className="kicker mb-2">{category}</p>}
        <h3 className="mb-1 text-[15px] leading-6 font-medium text-white group-hover:text-[#d4af37]">
          {displayName(product, variant)}
        </h3>
        <p className="mb-4 text-[14px] text-[#d4af37]">{price}</p>
      </Link>
      <div className="mt-auto">
        <QuickAdd item={item} />
      </div>
    </article>
  );
}
