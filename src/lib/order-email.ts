import type { StoredOrder } from "./orders.ts";
import { formatPrice } from "./products.ts";

export type OrderEmail = {
  to: string;
  subject: string;
  text: string;
};

export function orderConfirmationMessage(order: StoredOrder): OrderEmail {
  const lines = order.items
    .map((item) => `${item.name} × ${item.qty} — ${formatPrice((item.unitAmountCents * item.qty) / 100)}`)
    .join("\n");
  const total = `${formatPrice(order.totalCents / 100)} ${order.currency.toUpperCase()}`;
  return {
    to: order.email,
    subject: `Redline Labs order ${order.reference} paid`,
    text: [
      `Hello ${order.firstName},`,
      "",
      `Payment for order ${order.reference} has been received.`,
      "",
      lines,
      "",
      `Total ${total}.`,
      "",
      "This order is queued for dispatch. Research-use goods are not for human consumption.",
      "",
      "Redline Labs",
    ].join("\n"),
  };
}

/**
 * Sends through Resend's HTTP API. The key stays on the server. A missing
 * key throws so the webhook can retry once the sender is configured.
 */
export async function sendOrderConfirmation(
  order: StoredOrder,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.ORDER_EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) {
    throw new Error("Order email is not configured");
  }
  const message = orderConfirmationMessage(order);
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(`Order email failed (${response.status})`);
  }
}
