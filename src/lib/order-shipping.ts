/** Display lines for an order address. Old rows store null and must stay renderable. */
export type ShippingAddressView = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
};

const NO_ADDRESS = "No address on file";

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/[\r\n]+/g, " ").trim();
}

/**
 * Packing label for emails, the order page, and the admin desk.
 * A missing or blank line 1 is the empty state, never a throw.
 */
export function formatShippingAddress(shipping: ShippingAddressView | null | undefined): string {
  const line1 = clean(shipping?.line1);
  if (!line1) return NO_ADDRESS;
  const line2 = clean(shipping?.line2);
  const locality = [clean(shipping?.city), clean(shipping?.state), clean(shipping?.postcode)]
    .filter(Boolean)
    .join(" ");
  const country = clean(shipping?.country);
  return [line1, line2, locality, country].filter(Boolean).join("\n");
}
