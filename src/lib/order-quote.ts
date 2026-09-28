import { applyPercentOff, checkoutTotals, promoDiscountCents, type CheckoutPromo } from "./promo-pricing.ts";

/** Catalogue subtotal at which the order takes 10% off, in cents. */
export const VOLUME_DISCOUNT_THRESHOLD_CENTS = 20_000;

export const VOLUME_DISCOUNT_PERCENT = 10;

/** 10% of the catalogue subtotal once the order reaches $200. Below that, zero. */
export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_THRESHOLD_CENTS) return 0;
  return subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Server and display share this quote. The volume discount comes off the
 * catalogue subtotal first. A promo code then applies to what remains.
 * Browser prices are not an input.
 */
export function quoteOrder(subtotalCents: number, promo: CheckoutPromo | null) {
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

/** Turns dollar cart lines into the same quote the server charges. */
export function quoteDisplayedCart(
  items: Array<{ price: number; qty: number }>,
  promo: CheckoutPromo | null,
) {
  const catalogCents = checkoutTotals({ items, promo: null }).catalogCents;
  return quoteOrder(catalogCents, promo);
}

/**
 * Historical bank-transfer orders stored a promo-only total. When the stored
 * total matches the current quote, the breakdown is safe to show. Otherwise
 * the caller shows one combined discount.
 */
export function explainChargedTotal(
  subtotalCents: number,
  totalCents: number,
  promo: CheckoutPromo | null,
) {
  const quote = quoteOrder(subtotalCents, promo);
  if (quote.totalCents === totalCents) {
    return {
      matches: true,
      volumeDiscountCents: quote.volumeDiscountCents,
      promoDiscountCents: quote.promoDiscountCents,
    };
  }
  return {
    matches: false,
    volumeDiscountCents: 0,
    promoDiscountCents: Math.max(0, subtotalCents - totalCents),
  };
}
