"use server";

import { createEmbeddedCheckoutSession } from "@/lib/checkout-session";
import { type CartLineInput } from "@/lib/order";
import { getProduct, products } from "@/lib/products";

export async function startCheckoutSession(productId: string) {
  const product =
    getProduct(productId) ??
    (Number.isFinite(Number(productId))
      ? products.find((item) => item.id === Number(productId))
      : undefined);

  if (!product) {
    throw new Error("That product is not in the catalogue");
  }

  return createEmbeddedCheckoutSession({
    items: [
      {
        slug: product.slug,
        option: product.variants[0]?.option ?? null,
        qty: 1,
      },
    ],
  });
}

export async function startCartCheckoutSession(input: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
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
  });
}
