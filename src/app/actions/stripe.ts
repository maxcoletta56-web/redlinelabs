"use server";

import { createEmbeddedCheckoutSession, type ShippingAddressInput } from "@/lib/checkout-session";
import { type CartLineInput } from "@/lib/order";

export async function startCartCheckoutSession(input: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const email = input.email.trim();
  if (!email.includes("@")) {
    throw new Error("A valid email is required");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  return createEmbeddedCheckoutSession({
    items: input.items,
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    shipping: input.shipping,
    promoCode: input.promoCode,
    ageConfirmed: true,
    researchUse: true,
  });
}
