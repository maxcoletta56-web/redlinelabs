import { NextResponse } from "next/server";
import { scheduleEmail } from "@/lib/schedule-email";
import { sendPaymentActionEmail, sendPaymentReceivedEmail } from "@/lib/mailer";
import { awardOrderPoints } from "@/lib/club-db";
import { receiveWhopWebhook } from "@/lib/whop-webhook";

export const runtime = "nodejs";

/**
 * Whop posts the raw body. The signature covers those exact bytes, so this
 * route reads `request.text()` and never a re-serialized JSON value.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await receiveWhopWebhook(rawBody, request.headers, {
    secret: process.env.WHOP_WEBHOOK_SECRET,
    sendConfirmation: async (order) => {
      try {
        await awardOrderPoints({
          email: order.email,
          orderReference: order.reference,
          paidCents: order.totalCents,
        });
      } catch (error) {
        console.error("[club] award on Whop payment failed", {
          reference: order.reference,
          errorName: error instanceof Error ? error.name : "unknown",
        });
      }
      scheduleEmail(order.reference, () =>
        sendPaymentReceivedEmail({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          totalCents: order.totalCents,
        }),
      );
    },
    sendRecovery: async (order, recoveryUrl) => {
      scheduleEmail(order.reference, () =>
        sendPaymentActionEmail({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          recoveryUrl,
        }),
      );
    },
  });
  if (result.status === 401) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (result.status === 400) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (result.status === 500) {
    return NextResponse.json({ error: "Webhook was not applied" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
