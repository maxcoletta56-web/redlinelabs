import type { StoredOrder } from "./orders.ts";

function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export type OrderMail = {
  apiKey: string;
  from: string;
  fetchImpl?: typeof fetch;
};

export function orderConfirmationMessage(order: StoredOrder) {
  const lines = order.items
    .map((item) => `- ${item.name} × ${item.qty}`)
    .join("\n");
  const total = `${formatAud(order.totalCents)} ${order.currency.toUpperCase()}`;
  const text = [
    `Payment received for Redline Labs order ${order.reference}.`,
    "",
    `Total: ${total}`,
    "",
    "Items:",
    lines || "- (no lines recorded)",
    "",
    "The order is queued for dispatch. These products are supplied for laboratory research only.",
    "",
    `Questions about this order: reply to this email and quote ${order.reference}.`,
  ].join("\n");
  return {
    from: "",
    to: [order.email],
    subject: `Redline Labs order ${order.reference} is paid`,
    text,
  };
}

/** Sends the paid-order receipt. Throws when the provider is missing or rejects the message. */
export async function sendOrderConfirmation(order: StoredOrder, mail: OrderMail) {
  const apiKey = mail.apiKey.trim();
  const from = mail.from.trim();
  if (!apiKey || !from) {
    throw new Error("Order confirmation email is not configured");
  }
  const message = orderConfirmationMessage(order);
  const response = await (mail.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...message, from }),
  });
  if (!response.ok) {
    throw new Error("Confirmation email was not accepted");
  }
}
