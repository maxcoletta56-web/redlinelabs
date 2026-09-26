import "server-only";

import { absoluteUrl } from "./seo.ts";
import { getOrderStore } from "./order-store.ts";
import { prepareCheckout, type PrepareCheckoutInput } from "./prepare-checkout.ts";
import { createCardCheckoutSession } from "./whop.ts";
import { bankTransferDetails } from "./whop-config.ts";

export async function createCheckoutOrder(input: PrepareCheckoutInput) {
  return prepareCheckout(input, {
    store: getOrderStore(),
    createCardCheckout: createCardCheckoutSession,
    bankDetails: bankTransferDetails(process.env),
    returnUrlFor: (orderId) =>
      absoluteUrl(`/checkout/success?order_id=${encodeURIComponent(orderId)}`),
  });
}
