import { lineLabel } from "./order.ts";
import type { StoredOrder } from "./orders.ts";
import { formatPrice } from "./products.ts";
import { COMPANY_EMAIL } from "./company.ts";

export function confirmationEmail(order: StoredOrder) {
  const lines = order.lines
    .map((line) => `${lineLabel(line)} × ${line.qty} — ${formatPrice(line.unitAmountCents / 100)}`)
    .join("\n");
  const text = [
    `Redline Labs order ${order.id}`,
    "",
    "Your card payment was received.",
    "",
    lines,
    "",
    `Total: ${formatPrice(order.totalCents / 100)} AUD`,
    "",
    "This purchase is for laboratory research use only and is not for human consumption.",
    `Questions: ${COMPANY_EMAIL}`,
  ].join("\n");
  return {
    to: order.email,
    subject: `Redline Labs order ${order.id}`,
    text,
  };
}

export async function sendOrderConfirmation(order: StoredOrder, fetchImpl: typeof fetch = fetch) {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.ORDER_FROM_EMAIL?.trim() ?? "";
  if (!key || !from) {
    throw new Error("Confirmation email is not configured");
  }
  const message = confirmationEmail(order);
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error("Confirmation email failed");
  }
}
