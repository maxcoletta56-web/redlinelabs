import { COMPANY_EMAIL } from "./company.ts";
import type { StoredOrder } from "./orders.ts";

function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
};

export function orderConfirmationMessage(order: StoredOrder): OutboundEmail {
  const total = formatAud(order.totalCents);
  const lines = order.lines
    .map((line) => `${line.qty} × ${line.name}${line.option ? ` (${line.option})` : ""}`)
    .join("\n");
  return {
    to: order.email,
    subject: `Redline Labs order ${order.id} confirmed`,
    text: [
      "Your card payment was received.",
      "",
      `Order: ${order.id}`,
      `Total: ${total} AUD`,
      lines,
      "",
      "Orders are typically processed within 1–3 business days after payment confirmation.",
      `Questions: ${COMPANY_EMAIL}`,
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
  };
}

export async function sendOrderConfirmation(order: StoredOrder) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_CONFIRMATION_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Order confirmation email is not configured");
  }
  const message = orderConfirmationMessage(order);
  const response = await fetch("https://api.resend.com/emails", {
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
    throw new Error("Confirmation email failed");
  }
}
