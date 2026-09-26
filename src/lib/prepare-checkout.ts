import { quoteCart } from "./cart-quote.ts";
import type { OrderStore } from "./order-store.ts";
import { createPendingOrder, type ServerOrder } from "./server-order.ts";
import type { ShippingAddressInput } from "./shipping.ts";
import type { CartLineInput } from "./order.ts";
import { bankTransferDetails, type WhopEnvironment, type WhopEnv } from "./whop-config.ts";

export type CardSession = {
  planId: string;
  sessionId: string;
  environment: WhopEnvironment;
};

export type PrepareCheckoutInput = {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  paymentMethod: "card" | "bank_transfer";
};

export type PreparedCheckout = {
  orderId: string;
  email: string;
  totalCents: number;
  subtotalCents: number;
  volumeDiscountCents: number;
  promoDiscountCents: number;
  currency: "aud";
} & (
  | {
      method: "card";
      planId: string;
      sessionId: string;
      environment: WhopEnvironment;
      returnUrl: string;
    }
  | {
      method: "bank_transfer";
      accountName: string | null;
      bsb: string | null;
      accountNumber: string | null;
    }
);

export async function prepareCheckout(
  input: PrepareCheckoutInput,
  deps: {
    store: OrderStore;
    createCardCheckout: (order: ServerOrder, returnUrl: string) => Promise<CardSession>;
    bankDetails: ReturnType<typeof bankTransferDetails>;
    returnUrlFor: (orderId: string) => string;
    now?: Date;
    orderId?: string;
  },
): Promise<PreparedCheckout> {
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const quote = quoteCart(input.items, input.promoCode);
  if (quote.totalCents <= 0) throw new Error("Order total must be greater than zero");

  const order = createPendingOrder({
    id: deps.orderId,
    quote,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    shipping: input.shipping,
    paymentMethod: input.paymentMethod,
    now: deps.now,
  });
  await deps.store.put(order);

  const priced = {
    orderId: order.id,
    email: order.email,
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    volumeDiscountCents: order.volumeDiscountCents,
    promoDiscountCents: order.promoDiscountCents,
    currency: "aud" as const,
  };

  if (input.paymentMethod === "bank_transfer") {
    return { ...priced, method: "bank_transfer", ...deps.bankDetails };
  }

  const returnUrl = deps.returnUrlFor(order.id);
  const session = await deps.createCardCheckout(order, returnUrl);
  await deps.store.put({
    ...order,
    whopCheckoutId: session.sessionId,
    whopPlanId: session.planId,
  });
  return {
    ...priced,
    method: "card",
    planId: session.planId,
    sessionId: session.sessionId,
    environment: session.environment,
    returnUrl,
  };
}

export function bankDetailsFromEnv(env: WhopEnv) {
  return bankTransferDetails(env);
}
