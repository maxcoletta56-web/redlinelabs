"use client";

import { applyPercentOff } from "@/lib/promo";
import { usePromo } from "@/lib/promo-state";
import { formatPrice } from "@/lib/products";
import { centsToDollars, dollarsToCents } from "@/lib/store-credit";

export function CatalogPrice({
  amount,
  qty = 1,
  className,
}: {
  amount: number;
  qty?: number;
  className?: string;
}) {
  const { promo } = usePromo();
  const catalog = amount * qty;
  if (!promo) {
    return <span className={className}>{formatPrice(catalog)}</span>;
  }

  const sale = centsToDollars(
    applyPercentOff(dollarsToCents(amount), promo.percentOff) * qty,
  );

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className ?? ""}`.trim()}>
      <span className="font-normal text-[#8f8c84] line-through">
        {formatPrice(catalog)}
      </span>
      {formatPrice(sale)}
    </span>
  );
}
