import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { sendPaymentConfirmedEmails } from "@/lib/mailer";
import { scheduleEmail } from "@/lib/schedule-email";
import { handleWhopWebhookEvent } from "@/lib/whop-webhook";
import { parseWhopWebhookEvent, resolveWhop, verifyWhopWebhook, WhopWebhookError } from "@/lib/whop";

export const dynamic = "force-dynamic";

/**
 * Whop signs the raw body. payment.succeeded marks the order paid and sends
 * the confirmation email. payment.failed marks a pending order failed.
 * A repeated Whop payment id does not send another email.
 */
export async function POST(request: Request) {
  const config = resolveWhop(process.env);
  if (!config?.webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  }

  const body = await request.text();
  try {
    verifyWhopWebhook(
      body,
      {
        id: request.headers.get("webhook-id"),
        timestamp: request.headers.get("webhook-timestamp"),
        signature: request.headers.get("webhook-signature"),
      },
      config.webhookSecret,
    );
  } catch (error) {
    if (error instanceof WhopWebhookError) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    throw error;
  }

  let event;
  try {
    event = parseWhopWebhookEvent(body);
  } catch (error) {
    if (error instanceof WhopWebhookError) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }
    throw error;
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  }

  const result = await handleWhopWebhookEvent(event, {
    sql,
    deliver: async (order) => {
      scheduleEmail(order.reference, () =>
        sendPaymentConfirmedEmails({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          totalCents: order.totalCents,
        }),
      );
    },
  });

  if (result.outcome === "missing") {
    return NextResponse.json({ error: "Order not found" }, { status: 500 });
  }
  if (result.outcome === "mismatch") {
    console.error("[whop] payment amount did not match the order", { reference: result.reference });
  }

  return new Response("OK", { status: 200 });
}
