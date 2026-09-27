import { NextResponse } from "next/server";
import { sendOrderConfirmation } from "@/lib/order-email";
import { WhopSignatureError, verifyWhopWebhook } from "@/lib/whop-signature";
import { applyWhopPayment, readWhopPaymentNotice } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  let event: unknown;
  try {
    event = verifyWhopWebhook(payload, request.headers, process.env.WHOP_WEBHOOK_SECRET);
  } catch (error) {
    if (error instanceof WhopSignatureError && error.code === "missing_key") {
      return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const notice = readWhopPaymentNotice(event);
  if (!notice) return new Response("ok", { status: 200 });

  try {
    const result = await applyWhopPayment(notice, { sendConfirmation: sendOrderConfirmation });
    return new Response(result.body, { status: result.status });
  } catch (error) {
    console.error("[whop-webhook] handler failed", {
      type: notice.type,
      paymentId: notice.paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return new Response("retry", { status: 500 });
  }
}
