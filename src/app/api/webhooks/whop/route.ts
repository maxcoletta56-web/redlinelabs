import { NextResponse } from "next/server";
import { sendOrderConfirmation } from "@/lib/order-email";
import { getOrderStore } from "@/lib/order-store";
import { handleWhopWebhook, WebhookSignatureError } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  try {
    const result = await handleWhopWebhook({
      rawBody,
      headers: request.headers,
      secret,
      store: getOrderStore(),
      sendEmail: (order) => sendOrderConfirmation(order),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    throw error;
  }
}
