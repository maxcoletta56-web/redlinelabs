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

/** Card checkout takes 10% off once the catalogue subtotal reaches $200. */
export const VOLUME_DISCOUNT_THRESHOLD_CENTS = 20_000;
export const VOLUME_DISCOUNT_PERCENT = 10;

export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_THRESHOLD_CENTS) return 0;
  return subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Card-rail total. Volume discount comes off the catalogue subtotal first;
 * a promo code, when one is valid, is then a percent of what remains.
 * Callers must pass catalogue cents, never a price from the browser.
 */
export function cardPayableCents(subtotalCents: number, promo: CheckoutPromo | null) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const volume = volumeDiscountCents(subtotal);
  const afterVolume = subtotal - volume;
  const promoDiscount = promoDiscountCents(afterVolume, promo);
  return {
    subtotalCents: subtotal,
    volumeDiscountCents: volume,
    promoDiscountCents: promoDiscount,
    totalCents: afterVolume - promoDiscount,
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
