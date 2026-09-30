import { applyPercentOff, promoDiscountCents, type CheckoutPromo } from "./promo-pricing.ts";

/** Catalogue subtotal, in cents, at which card checkout takes 10% off. */
export const VOLUME_DISCOUNT_MIN_CENTS = 20_000;

export const VOLUME_DISCOUNT_PERCENT = 10;

/** 10% of the catalogue subtotal once the order reaches $200. Otherwise zero. */
export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_MIN_CENTS) return 0;
  return subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Card total from a catalogue subtotal. A promo and the $200 volume discount
 * both come off that subtotal. The combined discount cannot exceed it.
 * Callers must pass cents computed from the catalogue, never a browser price.
 */
export function priceCardCart(subtotalCents: number, promo: CheckoutPromo | null) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  const promoOffCents = promoDiscountCents(subtotal, promo);
  const volumeOffCents = volumeDiscountCents(subtotal);
  const discountCents = Math.min(subtotal, promoOffCents + volumeOffCents);
  return {
    subtotalCents: subtotal,
    promoOffCents,
    volumeOffCents,
    discountCents,
    totalCents: subtotal - discountCents,
    promoCode: promo?.code ?? null,
  };
}
