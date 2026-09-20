"use server";

import { createEmbeddedCheckoutSession, type ShippingAddressInput } from "@/lib/checkout-session";
import { type CartLineInput } from "@/lib/order";

export async function startCartCheckoutSession(input: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  storeCreditCents?: number;
  promoCode?: string | null;
}) {
  const email = input.email.trim();
  if (!email.includes("@")) {
    throw new Error("A valid email is required");
  }

  return createEmbeddedCheckoutSession({
    items: input.items,
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    shipping: input.shipping,
    storeCreditCents: input.storeCreditCents,
    promoCode: input.promoCode,
  });
}
