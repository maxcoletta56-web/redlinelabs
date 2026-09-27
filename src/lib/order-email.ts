import "server-only";

import { orderConfirmationText } from "@/lib/order-confirmation";
import type { StoredOrder } from "@/lib/orders";

export class OrderEmailNotConfiguredError extends Error {
  constructor() {
    super("Order email is not configured");
    this.name = "OrderEmailNotConfiguredError";
  }
}

type FetchLike = typeof fetch;

/** Sends the paid-order receipt through Resend. The API key stays on the server. */
export async function sendOrderConfirmation(
  order: StoredOrder,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
) {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.ORDER_EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) throw new OrderEmailNotConfiguredError();

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject: `Redline Labs order ${order.reference} is paid`,
      text: orderConfirmationText(order),
    }),
  });
  if (!response.ok) {
    throw new Error(`Confirmation email was not accepted (${response.status})`);
  }
}
