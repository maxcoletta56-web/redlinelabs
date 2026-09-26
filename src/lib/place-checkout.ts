import "server-only";

import { bankDetails } from "@/lib/bank-transfer";
import type { CartLineInput } from "@/lib/order";
import type { OrderShipping } from "@/lib/orders";
import { createNeonOrderStore } from "@/lib/orders-db";
import { placeOrder } from "@/lib/place-order";
import type { CheckoutPaymentMethod } from "@/lib/validation";

export async function placeCheckoutOrder(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: OrderShipping | null;
  promoCode?: string | null;
  paymentMethod: CheckoutPaymentMethod;
  origin: string;
}) {
  const placed = await placeOrder(createNeonOrderStore(), {
    items: input.items,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    shipping: input.shipping,
    promoCode: input.promoCode,
    paymentMethod: input.paymentMethod,
    env: process.env,
    returnUrlFor: (orderId) => `${input.origin}/checkout/return?order=${orderId}`,
  });
  return {
    method: input.paymentMethod,
    orderId: placed.order.id,
    sessionId: placed.sessionId,
    environment: placed.environment,
    totalCents: placed.order.totalCents,
    returnUrl: `${input.origin}/checkout/return?order=${placed.order.id}`,
    bankDetails: input.paymentMethod === "bank_transfer" ? bankDetails(process.env) : null,
  };
}
