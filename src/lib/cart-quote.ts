import { resolveCartLines, type CartLineInput, type ResolvedLine } from "./order.ts";
import { applyPercentOff, lookupPromo, promoDiscountCents } from "./promo.ts";

/** Catalogue subtotal at which the order receives 10% off, in cents. */
export const VOLUME_DISCOUNT_MINIMUM_CENTS = 20_000;
export const VOLUME_DISCOUNT_PERCENT = 10;

export type OrderQuote = {
  lines: ResolvedLine[];
  subtotalCents: number;
  volumeDiscountCents: number;
  promoCode: string;
  promoPercentOff: number;
  promoDiscountCents: number;
  totalCents: number;
};

export function volumeDiscountCents(subtotalCents: number) {
  const subtotal = Math.max(0, Math.round(subtotalCents));
  if (subtotal < VOLUME_DISCOUNT_MINIMUM_CENTS) return 0;
  return subtotal - applyPercentOff(subtotal, VOLUME_DISCOUNT_PERCENT);
}

/**
 * Prices a cart from catalogue lines. The 10% discount applies to the
 * catalogue subtotal when it is $200 or more, then any promo applies to
 * the remainder. Caller-supplied unit prices are not an input.
 */
export function quoteCart(items: CartLineInput[], promoInput?: string | null): OrderQuote {
  const lines = resolveCartLines(items);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const volumeOff = volumeDiscountCents(subtotalCents);
  const afterVolume = subtotalCents - volumeOff;
  const promo = lookupPromo(promoInput);
  const promoOff = promoDiscountCents(afterVolume, promo);
  return {
    lines,
    subtotalCents,
    volumeDiscountCents: volumeOff,
    promoCode: promo?.code ?? "",
    promoPercentOff: promo?.percentOff ?? 0,
    promoDiscountCents: promoOff,
    totalCents: afterVolume - promoOff,
  };
}
