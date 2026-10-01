import { NextResponse } from "next/server";
import { settleWhopPayment } from "@/lib/whop-payment";
import { parseWhopWebhook } from "@/lib/whop-event";
import { verifyWhopWebhook, WhopSignatureError } from "@/lib/whop-signature";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }

  const payload = await request.text();
  let event: unknown;
  try {
    event = verifyWhopWebhook(payload, request.headers, secret);
  } catch (error) {
    if (error instanceof WhopSignatureError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const parsed = parseWhopWebhook(event);
  if (parsed.kind === "ignore" || parsed.kind === "requires_action") {
    if (parsed.kind === "requires_action") {
      console.info("[whop] payment requires action", {
        paymentId: parsed.paymentId,
        orderId: parsed.orderId,
        nextAction: parsed.nextAction,
      });
    }
    return new Response("OK", { status: 200 });
  }

  try {
    const result = await settleWhopPayment(parsed.notice);
    console.info("[whop] payment settled", {
      type: parsed.notice.type,
      paymentId: parsed.notice.paymentId,
      outcome: result.outcome,
    });
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[whop] webhook handler failed", {
      paymentId: parsed.notice.paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
