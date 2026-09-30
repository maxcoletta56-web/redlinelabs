export type CheckoutPromo = {
  code: string;
  percentOff: number;
  name: string;
};

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
  const discountCents = promoDiscountCents(catalogCents, promo);
  return {
    catalogCents,
    discountedCents: catalogCents - discountCents,
    discountCents,
  };
}

/** Card orders at or above this catalogue subtotal take the volume percent off first. */
export const VOLUME_DISCOUNT_THRESHOLD_CENTS = 20_000;

export const VOLUME_DISCOUNT_PERCENT = 10;

export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_THRESHOLD_CENTS) return 0;
  return subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Card charge: 10% off the catalogue subtotal when it is at least $200, then
 * the promo percent on what remains. Bank transfer does not use this.
 */
export function cardChargeCents(subtotalCents: number, promo: CheckoutPromo | null) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const volumeOff = volumeDiscountCents(subtotal);
  const afterVolume = subtotal - volumeOff;
  const promoOff = promoDiscountCents(afterVolume, promo);
  return {
    volumeDiscountCents: volumeOff,
    promoDiscountCents: promoOff,
    totalCents: afterVolume - promoOff,
  };
}
