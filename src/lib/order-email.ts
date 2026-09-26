import { COMPANY_EMAIL } from "@/lib/company";
import { lineLabel } from "@/lib/order";
import type { StoredOrder } from "@/lib/orders";

export function confirmationText(order: StoredOrder) {
  const lines = order.lines
    .map((line) => `${lineLabel(line)} × ${line.qty}`)
    .join("\n");
  const total = (order.totalCents / 100).toFixed(2);
  return [
    `Your Redline Labs order ${order.id} is paid.`,
    "",
    lines,
    "",
    `Total: ${total} AUD`,
    "",
    "Orders are typically processed within 1–3 business days after payment confirmation.",
    `Questions: ${COMPANY_EMAIL}`,
  ].join("\n");
}

export async function sendOrderConfirmation(order: StoredOrder, fetchImpl: typeof fetch = fetch) {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.ORDER_FROM_EMAIL?.trim() || `Redline Labs <${COMPANY_EMAIL}>`;
  if (!key) throw new Error("Order email is not configured");
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject: `Redline Labs order ${order.id} confirmed`,
      text: confirmationText(order),
    }),
  });
  if (!response.ok) throw new Error("Confirmation email was not accepted");
}
