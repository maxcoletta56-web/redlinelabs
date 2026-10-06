import { NextResponse } from "next/server";
import { fulfillWhopPayment } from "@/lib/whop-fulfillment";
import { parseWhopPaymentEvent, readWhopWebhookHeaders, verifyWhopWebhook } from "@/lib/whop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Whop signs the raw body. Parsing JSON first would break the signature.
 * payment.succeeded marks the order paid and sends the confirmation email.
 * payment.failed marks it failed. The Whop payment id makes a redelivery a no-op.
 */
export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const payload = await request.text();
  let verified: unknown;
  try {
    verified = verifyWhopWebhook(payload, readWhopWebhookHeaders(request.headers), secret);
  } catch (error) {
    console.error("[whop] webhook rejected", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = parseWhopPaymentEvent(verified);
  if (!event) return new NextResponse("OK", { status: 200 });

  try {
    const result = await fulfillWhopPayment(event);
    console.info("[whop] webhook applied", {
      type: event.type,
      paymentId: event.paymentId,
      outcome: result.outcome,
    });
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[whop] webhook failed", {
      type: event.type,
      paymentId: event.paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
}
