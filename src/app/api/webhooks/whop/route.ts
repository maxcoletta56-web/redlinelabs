import { sendOrderConfirmation } from "@/lib/order-email";
import { applyWhopPayment } from "@/lib/orders";
import { createNeonOrderStore, ordersConfigured } from "@/lib/orders-db";
import { unwrapWebhook } from "@/lib/whop-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
  if (!secret) return new Response("Webhook secret not configured", { status: 503 });

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);
  let event;
  try {
    event = unwrapWebhook(payload, headers, secret);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  if (!ordersConfigured()) return new Response("Order storage is not configured", { status: 503 });

  try {
    const result = await applyWhopPayment(createNeonOrderStore(), event, sendOrderConfirmation);
    if (result.outcome === "missing") return new Response("Order not found", { status: 500 });
    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Webhook handling failed", { status: 500 });
  }
}
