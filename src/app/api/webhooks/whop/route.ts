import { NextResponse } from "next/server";
import { unwrapWhopWebhook } from "@/lib/whop";
import { handleWhopWebhook } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const payload = await request.text();
  let event: unknown;
  try {
    event = unwrapWhopWebhook(payload, request.headers, secret);
  } catch (error) {
    console.error("[whop] webhook signature rejected", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    const result = await handleWhopWebhook(event, {
      mail: {
        apiKey: process.env.RESEND_API_KEY?.trim() ?? "",
        from: process.env.ORDER_FROM_EMAIL?.trim() ?? "",
      },
    });
    if (result.retry) {
      return NextResponse.json({ error: "Confirmation email failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (error) {
    console.error("[whop] webhook failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
