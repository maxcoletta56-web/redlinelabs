import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { buildPaymentReceivedEmail, sendEmail } from "@/lib/mailer";
import { ordersConfigured, type StoredOrder } from "@/lib/orders";
import { fulfillWhopPayment, type ConfirmationResult } from "@/lib/whop-payments";
import { readWhopPaymentNotice, verifyWhopWebhook } from "@/lib/whop";

function orderPageUrl(reference: string) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://redlinelabs.shop").replace(
    /\/$/,
    "",
  );
  return `${base}/order/${encodeURIComponent(reference)}`;
}

/** Missing mail config and transport errors both ask Whop to retry. */
async function sendPaidConfirmation(order: StoredOrder): Promise<ConfirmationResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.ORDER_EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) return "unconfigured";
  try {
    await sendEmail(
      buildPaymentReceivedEmail({
        reference: order.reference,
        firstName: order.firstName,
        email: order.email,
        totalCents: order.totalCents,
        orderUrl: orderPageUrl(order.reference),
      }),
    );
    return "sent";
  } catch (error) {
    console.error("[whop] confirmation email failed", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return "failed";
  }
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }
  if (!ordersConfigured()) {
    return NextResponse.json({ error: "Orders are unavailable" }, { status: 503 });
  }

  const rawBody = await request.text();
  const verified = verifyWhopWebhook({
    rawBody,
    webhookId: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
    secret,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notice = readWhopPaymentNotice(payload);
  if ("ignore" in notice) return NextResponse.json({ received: true });
  if ("invalid" in notice) {
    console.error("[whop] payment event missing an order id");
    return NextResponse.json({ received: true });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "Orders are unavailable" }, { status: 503 });
  }

  try {
    const result = await fulfillWhopPayment({
      sql,
      paymentId: notice.paymentId,
      reference: notice.orderId,
      outcome: notice.type === "payment.succeeded" ? "paid" : "failed",
      sendConfirmation: sendPaidConfirmation,
    });
    if (result.status === 500) {
      return NextResponse.json({ error: "Confirmation is still pending" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[whop] webhook failed", {
      paymentId: notice.paymentId,
      reference: notice.orderId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
