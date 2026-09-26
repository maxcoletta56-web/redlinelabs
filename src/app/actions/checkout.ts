"use server";

import { headers } from "next/headers";
import { createCheckoutOrder } from "@/lib/checkout-order";
import { rateLimit } from "@/lib/rate-limit";
import type { ShippingAddressInput } from "@/lib/shipping";
import { checkoutBodySchema } from "@/lib/validation";

function paymentMethod(value: unknown) {
  return value === "bank_transfer" ? "bank_transfer" : "card";
}

export async function prepareCartCheckout(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  paymentMethod: "card" | "bank_transfer";
}) {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const limited = rateLimit(`checkout:${ip}`, 8, 10 * 60 * 1000);
  if (!limited.ok) throw new Error("Too many checkout attempts. Try again in a few minutes.");

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

  return createCheckoutOrder({
    items: parsed.data.items,
    email: parsed.data.email,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    shipping: input.shipping,
    promoCode: parsed.data.promoCode,
    ageConfirmed: true,
    researchUse: true,
    paymentMethod: paymentMethod(parsed.data.paymentMethod),
  });
}
