"use server";

import { headers } from "next/headers";
import { placeCheckoutOrder } from "@/lib/place-checkout";
import type { OrderShipping } from "@/lib/orders";
import { checkoutBodySchema } from "@/lib/validation";

async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://127.0.0.1:3000";
}

export async function startCartCheckoutSession(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: OrderShipping | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  paymentMethod: "card" | "bank_transfer";
}) {
  const parsed = checkoutBodySchema.safeParse({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
    items: input.items,
    promoCode: input.promoCode,
    paymentMethod: input.paymentMethod,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid checkout payload");
  }

  return placeCheckoutOrder({
    items: parsed.data.items,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    shipping: input.shipping,
    promoCode: parsed.data.promoCode,
    paymentMethod: parsed.data.paymentMethod,
    origin: await requestOrigin(),
  });
}
