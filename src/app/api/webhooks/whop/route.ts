import { NextResponse } from "next/server";
import { receiveWhopWebhook } from "@/lib/whop-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whop payment webhooks. The raw body is verified before it is trusted.
 * `payment.succeeded` marks the matching order paid and sends the confirmation
 * email. `payment.failed` marks it failed. The same Whop payment id is a no-op.
 * The browser return URL never marks an order paid.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const result = await receiveWhopWebhook(raw, request.headers, {
    secret: process.env.WHOP_WEBHOOK_SECRET,
  });
  if (result.status === 200) return NextResponse.json({ received: true });
  if (result.status === 503) {
    return NextResponse.json({ error: "Card webhooks are not configured" }, { status: 503 });
  }
  return NextResponse.json({ error: "invalid" }, { status: result.status });
}
