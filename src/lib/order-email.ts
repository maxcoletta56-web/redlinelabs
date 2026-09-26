import { COMPANY_EMAIL } from "./company.ts";
import { confirmationEmail } from "./whop-webhook.ts";
import type { ServerOrder } from "./server-order.ts";

export class ConfirmationEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmationEmailError";
  }
}

export async function sendOrderConfirmation(
  order: ServerOrder,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.ORDER_FROM_EMAIL?.trim() || "";
  if (!apiKey || !from) {
    throw new ConfirmationEmailError(
      "Confirmation email is not configured. Add RESEND_API_KEY and ORDER_FROM_EMAIL.",
    );
  }
  const message = confirmationEmail(order);
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `whop-payment-${order.whopPaymentId ?? order.id}`,
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      reply_to: COMPANY_EMAIL,
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new ConfirmationEmailError("Confirmation email was not accepted");
  }
}
