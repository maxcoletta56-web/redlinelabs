import type { CartLineInput } from "./order.ts";
import { resolveCartLines } from "./order.ts";
import { newOrderId, type OrderShipping, type OrderStore, type PaymentMethod } from "./orders.ts";
import { lookupPromo, priceSubtotal } from "./promo.ts";
import { createCardCheckoutSession, type CardCheckoutSession } from "./whop.ts";
import type { WhopEnv } from "./whop-config.ts";

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
): Promise<{ orderId: string; totalCents: number; session: CardCheckoutSession | null }> {
  const priced = priceCart(input.items, input.promoCode);
  if (priced.totalCents <= 0) throw new Error("This order has nothing to charge");
  const order = await store.insert({
    id: newOrderId(),
    email: input.email.trim().toLowerCase(),
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
    return { orderId: order.id, totalCents: order.totalCents, session: null };
  }

  try {
    const session = await createCardCheckoutSession(
      input.env,
      {
        orderId: order.id,
        totalCents: order.totalCents,
        returnUrl: input.returnUrlFor(order.id),
      },
      input.fetchImpl,
    );
    await store.attachCheckout(order.id, session.sessionId);
    return { orderId: order.id, totalCents: order.totalCents, session };
  } catch (error) {
    await store.markFailed(order.id, `checkout_${order.id}`);
    throw error;
  }
}
