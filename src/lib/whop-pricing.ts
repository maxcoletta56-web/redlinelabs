import { lineLabel, resolveCartLines, type CartLineInput, type ResolvedLine } from "./order.ts";
import { lookupPromo } from "./promo.ts";
import { cardPayableCents } from "./promo-pricing.ts";

export type PricedCardOrder = {
  lines: ResolvedLine[];
  subtotalCents: number;
  volumeDiscountCents: number;
  promoDiscountCents: number;
  totalCents: number;
  promoCode: string | null;
};

/**
 * Prices a card order from the catalogue. `CartLineInput` has no price field;
 * anything else on the payload is ignored by `resolveCartLines`.
 */
export function priceCardOrder(
  items: CartLineInput[],
  promoCode: string | null | undefined,
): PricedCardOrder {
  const lines = resolveCartLines(items);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const promo = lookupPromo(promoCode);
  const priced = cardPayableCents(subtotalCents, promo);
  if (priced.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return {
    lines,
    subtotalCents: priced.subtotalCents,
    volumeDiscountCents: priced.volumeDiscountCents,
    promoDiscountCents: priced.promoDiscountCents,
    totalCents: priced.totalCents,
    promoCode: promo?.code ?? null,
  };
}

export function cardLineSnapshots(lines: ResolvedLine[]) {
  return lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));
}
