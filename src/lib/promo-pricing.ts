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

/** Catalogue orders of $200 or more take 10% off before any coupon. */
export const VOLUME_DISCOUNT_THRESHOLD_CENTS = 20_000;
export const VOLUME_DISCOUNT_PERCENT = 10;

export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_THRESHOLD_CENTS) return 0;
  return subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Server and browser summaries both use this. The volume discount is applied
 * to the catalogue subtotal, then a coupon percent is taken from what remains.
 */
export function priceOrderCents(subtotalCents: number, promo: CheckoutPromo | null) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const volumeCents = volumeDiscountCents(subtotal);
  const afterVolume = subtotal - volumeCents;
  const promoCents = promoDiscountCents(afterVolume, promo);
  return {
    subtotalCents: subtotal,
    volumeDiscountCents: volumeCents,
    promoDiscountCents: promoCents,
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
  const priced = priceOrderCents(catalogCents, promo);
  return {
    catalogCents,
    discountedCents: priced.totalCents,
    discountCents: priced.promoDiscountCents,
    volumeDiscountCents: priced.volumeDiscountCents,
  };
}
