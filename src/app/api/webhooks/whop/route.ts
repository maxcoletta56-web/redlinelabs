import { NextResponse } from "next/server";
import { OrdersUnavailableError, getOrderStore } from "@/lib/orders-db";
import { sendOrderConfirmation } from "@/lib/order-email";
import { handleWhopWebhook, WebhookSignatureError } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  try {
    const store = await getOrderStore();
    const result = await handleWhopWebhook({
      rawBody,
      headers: request.headers,
      secret,
      store,
      sendEmail: (order) => sendOrderConfirmation(order),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
    }
    if (error instanceof OrdersUnavailableError) {
      return NextResponse.json({ ok: false, error: "Orders are not configured" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Webhook failed" }, { status: 500 });
  }
}
