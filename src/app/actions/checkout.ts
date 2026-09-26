"use server";

import { createPayoneerCheckout, type ShippingAddressInput } from "@/lib/checkout-session";
import { checkoutBodySchema } from "@/lib/validation";

export async function startCartCheckoutSession(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const parsed = checkoutBodySchema.safeParse({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
    items: input.items,
    promoCode: input.promoCode,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid checkout payload");
  }

  return createPayoneerCheckout({
    items: parsed.data.items,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    shipping: input.shipping,
    promoCode: parsed.data.promoCode,
    ageConfirmed: true,
    researchUse: true,
  });
}
