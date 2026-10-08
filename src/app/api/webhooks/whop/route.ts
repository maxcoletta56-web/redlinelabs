import { NextResponse } from "next/server";
import { applyWhopPayment } from "@/lib/orders";
import { handleWhopWebhook, type WhopWebhookEvent, type WhopWebhookPayment } from "@/lib/whop-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whop payment webhooks. The raw body is verified before it is trusted.
 * `payment.succeeded` marks the order paid and sends the confirmation email.
 * `payment.failed` marks it failed. Repeating a payment id is a no-op.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const result = await handleWhopWebhook({
    raw,
    headers: request.headers,
    secret: process.env.WHOP_WEBHOOK_SECRET,
    settle: (event) => settleWhopEvent(event),
  });
  return NextResponse.json(result.body, { status: result.status });
}

async function settleWhopEvent(event: WhopWebhookEvent & { payment: WhopWebhookPayment }) {
  const outcome = event.type === "payment.succeeded" ? "succeeded" : "failed";
  return applyWhopPayment({
    orderId: event.payment.orderId,
    paymentId: event.payment.id,
    outcome,
    currency: event.payment.currency,
    total: event.payment.total,
  });
}
