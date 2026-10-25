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

/** Card orders of $200 or more take 10% off the catalogue subtotal, before any coupon. */
export const CARD_VOLUME_THRESHOLD_CENTS = 20_000;
export const CARD_VOLUME_PERCENT = 10;

export function volumeDiscountCents(subtotalCents: number) {
  const amount = Math.max(0, Math.round(subtotalCents));
  if (amount < CARD_VOLUME_THRESHOLD_CENTS) return 0;
  return amount - applyPercentOff(amount, CARD_VOLUME_PERCENT);
}

/**
 * Card payable amount. The 10% volume discount is applied to the catalogue
 * subtotal first, then the promo percent is taken off what remains.
 * Bank transfer and PayPal do not use this.
 */
export function priceCardOrderCents(subtotalCents: number, promo: CheckoutPromo | null) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const volumeCents = volumeDiscountCents(subtotal);
  const afterVolume = subtotal - volumeCents;
  const promoCents = promoDiscountCents(afterVolume, promo);
  return {
    subtotalCents: subtotal,
    volumeCents,
    promoCents,
    totalCents: afterVolume - promoCents,
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
