export type CheckoutPromo = {
  code: string;
  percentOff: number;
  name: string;
};

function toCents(amount: number) {
  return Math.round(amount * 100);
}

/** Catalogue orders of $200 or more take 10% off before any promo code. */
export const VOLUME_DISCOUNT_THRESHOLD_CENTS = 20_000;
export const VOLUME_DISCOUNT_PERCENT = 10;

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

/** 10% of the catalogue subtotal once it reaches $200. Below that, nothing. */
export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_THRESHOLD_CENTS) return 0;
  return Math.max(0, subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT));
}

export function checkoutTotals({
  items,
  promo,
}: {
  items: Array<{ price: number; qty: number }>;
  promo: CheckoutPromo | null;
}) {
  const catalogCents = items.reduce((sum, item) => sum + toCents(item.price) * item.qty, 0);
  const volumeCents = volumeDiscountCents(catalogCents);
  const discountCents = promoDiscountCents(catalogCents - volumeCents, promo);
  return {
    catalogCents,
    volumeDiscountCents: volumeCents,
    discountedCents: catalogCents - volumeCents - discountCents,
    discountCents,
  };
}
