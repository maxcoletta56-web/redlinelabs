import { scheduleEmail } from "@/lib/schedule-email";
import { sendPaymentReceivedEmail } from "@/lib/mailer";
import { ordersConfigured } from "@/lib/orders";
import { applyWhopPaymentNotice } from "@/lib/whop-orders";
import { getSql } from "@/lib/db";
import { parseWhopWebhook, resolveWhop, verifyWhopWebhook, WhopSignatureError } from "@/lib/whop";

export const dynamic = "force-dynamic";

/**
 * Whop signs the raw body. Fulfillment runs only after that check. The
 * response is returned before the confirmation email is sent.
 */
export async function POST(request: Request) {
  const config = resolveWhop(process.env);
  if (!config || !ordersConfigured()) {
    return new Response("Whop webhooks are not configured", { status: 503 });
  }

  const body = await request.text();
  let payload: unknown;
  try {
    payload = verifyWhopWebhook({
      body,
      headers: request.headers,
      secret: config.webhookSecret,
    });
  } catch (error) {
    if (error instanceof WhopSignatureError) {
      return new Response("Invalid webhook signature", { status: 401 });
    }
    throw error;
  }

  const parsed = parseWhopWebhook(payload);
  if (parsed.kind === "invalid") {
    return new Response("Invalid payment event", { status: 400 });
  }
  if (parsed.kind === "payment") {
    const sql = getSql();
    if (!sql) return new Response("Whop webhooks are not configured", { status: 503 });
    try {
      const result = await applyWhopPaymentNotice(parsed.notice, sql);
      if (result.action === "paid") {
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
        paymentId: parsed.notice.paymentId,
        orderId: parsed.notice.orderId,
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return new Response("Webhook processing failed", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}
