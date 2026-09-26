import { resolveCartLines, type CartLineInput } from "./order.ts";
import { newOrderId, type OrderShipping, type OrderStore, type PaymentMethod } from "./orders.ts";
import { lookupPromo, priceSubtotal } from "./promo.ts";
import { createWhopCheckoutConfiguration, whopMode, type WhopEnv } from "./whop-checkout.ts";

export function priceCart(items: CartLineInput[], promoCode?: string | null) {
  const lines = resolveCartLines(items);
  const promo = lookupPromo(promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = priceSubtotal(subtotalCents, promo);
  return { lines, promo, ...priced };
}

export async function placeOrder(
  store: OrderStore,
  input: {
    items: CartLineInput[];
    email: string;
    firstName?: string;
    lastName?: string;
    shipping?: OrderShipping | null;
    promoCode?: string | null;
    paymentMethod: PaymentMethod;
    env: WhopEnv;
    returnUrlFor: (orderId: string) => string;
    fetchImpl?: typeof fetch;
  },
) {
  const priced = priceCart(input.items, input.promoCode);
  if (priced.totalCents <= 0) throw new Error("This order has nothing to charge");
  const email = input.email.trim().toLowerCase();
  const order = await store.insert({
    id: newOrderId(),
    email,
    firstName: input.firstName?.trim() || "Customer",
    lastName: input.lastName?.trim() || "Account",
    currency: "aud",
    subtotalCents: priced.subtotalCents,
    volumeDiscountCents: priced.volumeDiscountCents,
    promoCode: priced.promo?.code ?? "",
    promoDiscountCents: priced.promoDiscountCents,
    totalCents: priced.totalCents,
    lines: priced.lines,
    shipping: input.shipping ?? null,
    paymentMethod: input.paymentMethod,
  });

  if (input.paymentMethod === "bank_transfer") {
    return { order, sessionId: null as string | null, environment: whopMode(input.env) };
  }

  try {
    const checkout = await createWhopCheckoutConfiguration(
      input.env,
      {
        orderId: order.id,
        amountCents: order.totalCents,
        returnUrl: input.returnUrlFor(order.id),
      },
      input.fetchImpl,
    );
    await store.attachCheckout(order.id, checkout.id);
    return { order, sessionId: checkout.id, environment: checkout.mode };
  } catch (error) {
    await store.markFailed(order.id, `checkout_${order.id}`);
    throw error;
  }
}
