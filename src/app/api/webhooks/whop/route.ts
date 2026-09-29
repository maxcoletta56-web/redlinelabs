import { scheduleEmail } from "@/lib/schedule-email";
import { sendPaymentReceivedEmail } from "@/lib/mailer";
import { readWhopPaymentEvent, verifyWhopWebhook } from "@/lib/whop";
import { applyWhopPaymentEvent } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

/**
 * Whop signs the raw body. Parse only after the signature matches.
 * payment.succeeded marks the pending order paid and sends the confirmation.
 * payment.failed marks it failed. A repeated payment id is a no-op.
 */
export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return new Response("Webhook secret is not configured", { status: 503 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = verifyWhopWebhook(rawBody, request.headers, secret);
  } catch (error) {
    console.error("[whop] webhook rejected", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : "invalid signature",
    });
    return new Response("Invalid signature", { status: 401 });
  }

  const event = readWhopPaymentEvent(payload);
  if (!event) return new Response("OK", { status: 200 });

  try {
    const result = await applyWhopPaymentEvent(event);
    if (result.email && result.order) {
      const order = result.order;
      scheduleEmail(order.reference, () =>
        sendPaymentReceivedEmail({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          totalCents: order.totalCents,
        }),
      );
    }
  } catch (error) {
    console.error("[whop] webhook failed", {
      type: event.type,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
