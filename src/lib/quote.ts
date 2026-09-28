import { resolveCartLines, type CartLineInput, type ResolvedLine } from "./order.ts";
import { lookupPromo, orderChargeCents, type CheckoutPromo } from "./promo.ts";

export type CartQuote = {
  lines: ResolvedLine[];
  promo: CheckoutPromo | null;
  subtotalCents: number;
  volumeOffCents: number;
  promoOffCents: number;
  totalCents: number;
};

/** Catalogue prices only. A price on the incoming line is not part of CartLineInput. */
export function quoteCart(items: CartLineInput[], promoCode?: string | null): CartQuote {
  const lines = resolveCartLines(items);
  const promo = lookupPromo(promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const charge = orderChargeCents(subtotalCents, promo);
  if (charge.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return { lines, promo, ...charge };
}
