import type { CheckoutPromo } from "@/lib/promo-pricing";
import { formatPrice } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

export function CartDiscountLines({
  volumeDiscountCents,
  promoDiscountCents,
  promo,
  className = "mb-3",
}: {
  volumeDiscountCents: number;
  promoDiscountCents: number;
  promo: CheckoutPromo | null;
  className?: string;
}) {
  return (
    <>
      {volumeDiscountCents > 0 && (
        <div className={`${className} flex justify-between text-sm`}>
          <span>10% off orders of $200 or more</span>
          <span className="text-[#d4af37]">−{formatPrice(centsToDollars(volumeDiscountCents))}</span>
        </div>
      )}
      {promoDiscountCents > 0 && promo && (
        <div className={`${className} flex justify-between text-sm`}>
          <span>{promo.percentOff}% off total</span>
          <span className="text-[#d4af37]">−{formatPrice(centsToDollars(promoDiscountCents))}</span>
        </div>
      )}
    </>
  );
}
