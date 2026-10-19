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

/** Catalogue subtotal, in cents, at which the order takes 10% off. */
export const VOLUME_DISCOUNT_MINIMUM_CENTS = 20_000;

export const VOLUME_DISCOUNT_PERCENT = 10;

/** 10% off the catalogue subtotal once it reaches $200. Below that, zero. */
export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_MINIMUM_CENTS) return 0;
  return Math.round((subtotal * VOLUME_DISCOUNT_PERCENT) / 100);
}

/**
 * Payable total from a catalogue subtotal. The $200 volume discount is taken
 * first, then any promo percent on what remains.
 */
export function priceOrderCents(subtotalCents: number, promo: CheckoutPromo | null) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const volumeCents = volumeDiscountCents(subtotal);
  const afterVolume = subtotal - volumeCents;
  const discountCents = promoDiscountCents(afterVolume, promo);
  return {
    subtotalCents: subtotal,
    volumeDiscountCents: volumeCents,
    discountCents,
    totalCents: afterVolume - discountCents,
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
    volumeDiscountCents: priced.volumeDiscountCents,
    discountedCents: priced.totalCents,
    discountCents: priced.discountCents,
  };
}
