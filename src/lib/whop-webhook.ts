import type { Sql } from "./db.ts";
import { sendOrderConfirmation, type OrderMail } from "./order-email.ts";
import {
  claimOrderConfirmation,
  releaseOrderConfirmation,
  settleWhopPayment,
} from "./orders.ts";
import { readWhopPaymentNotice } from "./whop.ts";

export type WhopWebhookResult = {
  outcome: "paid" | "failed" | "duplicate" | "ignored" | "action_required";
  retry: boolean;
};

/**
 * payment.requires_action is the buyer step (3D Secure or another redirect).
 * The embedded checkout completes it via returnUrl. The order stays pending
 * until payment.succeeded or payment.failed.
 */
export async function handleWhopWebhook(
  event: unknown,
  options: { sql?: Sql | null; mail?: OrderMail } = {},
): Promise<WhopWebhookResult> {
  const notice = readWhopPaymentNotice(event);
  if (!notice) return { outcome: "ignored", retry: false };
  if (notice.type === "requires_action") return { outcome: "action_required", retry: false };

  const settled = await settleWhopPayment(
    { reference: notice.orderId, paymentId: notice.paymentId, event: notice.type },
    options.sql,
  );
  if (settled.outcome !== "paid" || !settled.sendConfirmation) {
    return { outcome: settled.outcome, retry: false };
  }

  const claimed = await claimOrderConfirmation(notice.orderId, notice.paymentId, options.sql);
  if (!claimed) return { outcome: "duplicate", retry: false };
  try {
    await sendOrderConfirmation(claimed, options.mail ?? { apiKey: "", from: "" });
  } catch (error) {
    await releaseOrderConfirmation(notice.orderId, notice.paymentId, options.sql).catch(() => undefined);
    console.error("[whop] confirmation email failed", {
      reference: claimed.reference,
      paymentId: notice.paymentId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { outcome: "paid", retry: true };
  }
  return { outcome: "paid", retry: false };
}
