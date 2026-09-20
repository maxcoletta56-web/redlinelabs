export type CheckoutPromo = {
  code: string;
  percentOff: number;
  name: string;
};

export const CHECKOUT_PROMOS: Record<string, CheckoutPromo> = {
  DGC20: {
    code: "DGC20",
    percentOff: 20,
    name: "20% off order total",
  },
};

export function normalizePromoCode(input: string | null | undefined) {
  return (input ?? "").trim().toUpperCase();
}

export function lookupPromo(input: string | null | undefined): CheckoutPromo | null {
  const code = normalizePromoCode(input);
  if (!code) return null;
  return CHECKOUT_PROMOS[code] ?? null;
}

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
