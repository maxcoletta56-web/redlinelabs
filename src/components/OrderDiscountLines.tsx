import { formatPrice } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

export function OrderDiscountLines({
  volumeOffCents,
  promoOffCents,
  promoPercent,
  className = "mb-3",
}: {
  volumeOffCents: number;
  promoOffCents: number;
  promoPercent?: number | null;
  className?: string;
}) {
  return (
    <>
      {volumeOffCents > 0 && (
        <div className={`${className} flex justify-between text-sm`}>
          <span>10% off orders of $200 or more</span>
          <span className="text-[#d4af37]">−{formatPrice(centsToDollars(volumeOffCents))}</span>
        </div>
      )}
      {promoOffCents > 0 && (
        <div className={`${className} flex justify-between text-sm`}>
          <span>{promoPercent ?? 0}% off total</span>
          <span className="text-[#d4af37]">−{formatPrice(centsToDollars(promoOffCents))}</span>
        </div>
      )}
    </>
  );
}
