// Codes live here so client components cannot import them. Totals math is in promo-pricing.ts.
import type { CheckoutPromo } from "./promo-pricing.ts";

export type { CheckoutPromo } from "./promo-pricing.ts";

export {
  applyPercentOff,
  checkoutTotals,
  orderAmountDueCents,
  promoDiscountCents,
  stripeCouponParams,
  volumeDiscountCents,
  VOLUME_DISCOUNT_MINIMUM_CENTS,
  VOLUME_DISCOUNT_PERCENT,
} from "./promo-pricing.ts";

export const CHECKOUT_PROMOS: Record<string, CheckoutPromo> = {
  DGC20: {
    code: "DGC20",
    percentOff: 20,
    name: "20% off order total",
  },
  FAMILY70: {
    code: "FAMILY70",
    percentOff: 70,
    name: "70% off order total",
  },
};

export function normalizePromoCode(input: string | null | undefined) {
  return (input ?? "").trim().toUpperCase();
}

export function lookupPromo(input: string | null | undefined): CheckoutPromo | null {
  const code = normalizePromoCode(input);
  if (!code) return null;
  return CHECKOUT_PROMOS[code] ?? null;
}
