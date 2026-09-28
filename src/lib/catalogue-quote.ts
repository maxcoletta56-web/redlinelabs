import { lineLabel, resolveCartLines, type CartLineInput, type ResolvedLine } from "./order.ts";
import { quoteOrder } from "./order-quote.ts";
import { lookupPromo, type CheckoutPromo } from "./promo.ts";

export type CatalogueQuote = {
  lines: ResolvedLine[];
  promo: CheckoutPromo | null;
  subtotalCents: number;
  volumeDiscountCents: number;
  promoDiscountCents: number;
  totalCents: number;
  summary: string;
};

/** Prices come from the catalogue. A price field on the request is ignored. */
export function quoteCatalogueCart(
  items: CartLineInput[],
  promoCode?: string | null,
): CatalogueQuote {
  const lines = resolveCartLines(items);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const promo = lookupPromo(promoCode);
  const quote = quoteOrder(subtotalCents, promo);
  return {
    lines,
    promo,
    ...quote,
    summary: lines.map((line) => lineLabel(line)).join(", ").slice(0, 120),
  };
}
