"use server";

import { createEmbeddedCheckoutSession } from "@/lib/checkout-session";
import { type CartLineInput } from "@/lib/order";

export async function startCartCheckoutSession(input: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  ageConfirmed: boolean;
  researchUse: boolean;
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
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
  });
}
