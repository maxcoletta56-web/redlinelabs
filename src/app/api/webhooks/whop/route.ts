import { NextResponse } from "next/server";
import { fulfillWhopPayment } from "@/lib/whop-fulfillment";
import { readWhopPaymentNotice, verifyWhopWebhook } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = verifyWhopWebhook(rawBody, request.headers, secret);
  } catch (error) {
    console.error("[whop-webhook] signature rejected", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const notice = readWhopPaymentNotice(payload);
  if (!notice) {
    return NextResponse.json({ received: true, outcome: "ignored" });
  }

  try {
    const result = await fulfillWhopPayment(notice);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[whop-webhook] handler failed", {
      paymentId: notice.paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
