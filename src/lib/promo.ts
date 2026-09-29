export type CheckoutPromo = {
  code: string;
  percentOff: number;
  name: string;
};

export const CHECKOUT_PROMOS: Record<string, CheckoutPromo> = {
  DGC20: {
    code: "DGC20",
    percentOff: 20,
    name: "20% off order total",
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

function toCents(amount: number) {
  return Math.round(amount * 100);
}

/** Amount still payable after a percent-off discount, in cents. */
export function applyPercentOff(amountCents: number, percentOff: number) {
  const amount = Math.max(0, Math.round(amountCents));
  const percent = Math.min(100, Math.max(0, percentOff));
  if (percent === 0) return amount;
  return Math.round((amount * (100 - percent)) / 100);
}

export function promoDiscountCents(subtotalCents: number, promo: CheckoutPromo | null) {
  if (!promo) return 0;
  return Math.max(0, subtotalCents - applyPercentOff(subtotalCents, promo.percentOff));
}

/** Automatic 10% off once the catalogue subtotal reaches $200, before a coupon. */
export const VOLUME_DISCOUNT_PERCENT = 10;
export const VOLUME_DISCOUNT_MINIMUM_CENTS = 20_000;

export function volumeDiscountCents(subtotalCents: number) {
  const amount = Math.max(0, Math.round(subtotalCents));
  if (amount < VOLUME_DISCOUNT_MINIMUM_CENTS) return 0;
  return amount - applyPercentOff(amount, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Catalogue subtotal, then 10% when that subtotal is $200 or more, then the
 * coupon percent on what remains. Both payment methods use this result.
 */
export function orderTotalsFromCents(subtotalCents: number, promo: CheckoutPromo | null) {
  const catalogCents = Math.max(0, Math.round(subtotalCents));
  const volumeOff = volumeDiscountCents(catalogCents);
  const afterVolume = catalogCents - volumeOff;
  const promoOff = promoDiscountCents(afterVolume, promo);
  return {
    catalogCents,
    volumeDiscountCents: volumeOff,
    promoDiscountCents: promoOff,
    discountCents: volumeOff + promoOff,
    discountedCents: afterVolume - promoOff,
  };
}

export function stripeCouponParams({
  promo,
  promoOffCents,
  storeCreditCents,
}: {
  promo: CheckoutPromo | null;
  promoOffCents: number;
  storeCreditCents: number;
}):
  | { percent_off: number; duration: "once"; name: string }
  | { amount_off: number; currency: "aud"; duration: "once"; name: string }
  | null {
  const credit = Math.max(0, Math.floor(storeCreditCents));
  if (promo && credit === 0) {
    return {
      percent_off: promo.percentOff,
      duration: "once",
      name: promo.code,
    };
  }
  const amountOff = Math.max(0, Math.floor(promoOffCents)) + credit;
  if (amountOff <= 0) return null;
  const name = [promo?.code, credit > 0 ? "Store credit" : null].filter(Boolean).join(" + ");
  return {
    amount_off: amountOff,
    currency: "aud",
    duration: "once",
    name: name || "Discount",
  };
}

export function checkoutTotals({
  items,
  promo,
}: {
  items: Array<{ price: number; qty: number }>;
  promo: CheckoutPromo | null;
}) {
  const catalogCents = items.reduce((sum, item) => sum + toCents(item.price) * item.qty, 0);
  return orderTotalsFromCents(catalogCents, promo);
}
