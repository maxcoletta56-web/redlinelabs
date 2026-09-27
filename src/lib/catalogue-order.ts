import { lineLabel, resolveCartLines, type CartLineInput } from "./order.ts";
import type { NewOrder, OrderItemSnapshot, OrderShippingSnapshot } from "./orders.ts";
import { lookupPromo, priceSubtotal } from "./promo.ts";

export type CatalogueShippingInput = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * The address never affects the amount owed, so it is stored as typed after
 * trimming and length capping. Prices always come from the catalogue.
 */
export function normalizeShipping(
  shipping: CatalogueShippingInput | null | undefined,
): OrderShippingSnapshot | null {
  const line1 = trimmed(shipping?.line1, 200);
  if (!line1) return null;
  return {
    name: trimmed(shipping?.name, 120),
    line1,
    line2: trimmed(shipping?.line2, 200),
    city: trimmed(shipping?.city, 120),
    state: trimmed(shipping?.state, 60),
    postcode: trimmed(shipping?.postal_code, 20),
    country: trimmed(shipping?.country, 2).toUpperCase() || "AU",
  };
}

/**
 * Prices the cart from catalogue lines. A `price` field on the input is not
 * part of {@link CartLineInput} and is ignored by {@link resolveCartLines}.
 */
export function catalogueOrderDraft(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: CatalogueShippingInput | null;
  promoCode?: string | null;
}): NewOrder {
  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const catalogCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = priceSubtotal(catalogCents, promo);
  if (priced.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const items: OrderItemSnapshot[] = lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));

  return {
    currency: "aud",
    subtotalCents: priced.subtotalCents,
    totalCents: priced.totalCents,
    promoCode: promo?.code ?? null,
    firstName: trimmed(input.firstName, 120) || "Customer",
    lastName: trimmed(input.lastName, 120) || "Account",
    email: trimmed(input.email, 200).toLowerCase(),
    items,
    shipping: normalizeShipping(input.shipping),
  };
}
