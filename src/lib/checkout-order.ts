import "server-only";

import { headers } from "next/headers";
import { absoluteUrl } from "./seo";
import { getOrderStore } from "./order-store";
import { prepareCheckout, type PrepareCheckoutInput } from "./prepare-checkout";
import { createCardCheckoutSession } from "./whop";
import { bankTransferDetails, resolveWhop } from "./whop-config";

function requestOrigin(headerList: Headers) {
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return new URL(absoluteUrl("/")).origin;
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = forwarded || (local ? "http" : "https");
  return `${proto}://${host}`;
}

export async function createCheckoutOrder(input: PrepareCheckoutInput) {
  if (input.paymentMethod === "card" && !resolveWhop(process.env)) {
    throw new Error("Card checkout is not configured");
  }
  const headerList = await headers();
  const origin = requestOrigin(headerList);
  return prepareCheckout(input, {
    store: getOrderStore(),
    createCardCheckout: createCardCheckoutSession,
    bankDetails: bankTransferDetails(process.env),
    returnUrlFor: (orderId) =>
      `${origin}/checkout/success?order_id=${encodeURIComponent(orderId)}`,
  });
}
