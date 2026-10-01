import { normalizeOrderReference } from "./order-reference.ts";
import {
  findOrder,
  markWhopOrderFailed,
  markWhopOrderPaid,
  type StoredOrder,
} from "./orders.ts";
import type { WhopPaymentNotice } from "./whop-event.ts";

export type WhopSettlement =
  | { outcome: "paid"; order: StoredOrder }
  | { outcome: "failed"; order: StoredOrder }
  | { outcome: "duplicate" }
  | { outcome: "ignored" }
  | { outcome: "mismatch" };

type SettleHooks = {
  findOrder?: (reference: string) => Promise<StoredOrder | null>;
  markPaid?: (reference: string, paymentId: string) => Promise<StoredOrder | null>;
  markFailed?: (reference: string, paymentId: string) => Promise<StoredOrder | null>;
  scheduleEmail?: (reference: string, task: () => Promise<void>) => void;
  sendPaymentReceivedEmail?: (notice: {
    reference: string;
    firstName: string;
    email: string;
    totalCents: number;
  }) => Promise<void>;
};

function amountsMatch(order: StoredOrder, notice: WhopPaymentNotice) {
  if (notice.currency && notice.currency !== order.currency.toLowerCase()) return false;
  if (notice.amountCents == null) return true;
  return notice.amountCents === order.totalCents;
}

async function sendConfirmation(order: StoredOrder, hooks: SettleHooks) {
  try {
    const schedule = hooks.scheduleEmail;
    const send = hooks.sendPaymentReceivedEmail;
    if (schedule && send) {
      schedule(order.reference, () =>
        send({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          totalCents: order.totalCents,
        }),
      );
      return;
    }
    const [scheduleModule, mailer] = await Promise.all([
      import("./schedule-email.ts"),
      import("./mailer.ts"),
    ]);
    scheduleModule.scheduleEmail(order.reference, () =>
      mailer.sendPaymentReceivedEmail({
        reference: order.reference,
        firstName: order.firstName,
        email: order.email,
        totalCents: order.totalCents,
      }),
    );
  } catch (error) {
    console.error("[whop] payment email failed", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * Applies one Whop payment id once. A repeated `payment.succeeded` does not
 * send another email. `payment.failed` never downgrades a paid order.
 * `payment.requires_action` is not settled here — the embedded checkout finishes
 * 3D Secure and other redirects, and the order stays pending until success or failure.
 */
export async function settleWhopPayment(
  notice: WhopPaymentNotice,
  hooks: SettleHooks = {},
): Promise<WhopSettlement> {
  const reference = normalizeOrderReference(notice.orderId);
  if (!reference) return { outcome: "ignored" };

  const lookup = hooks.findOrder ?? findOrder;
  const existing = await lookup(reference);
  if (!existing) return { outcome: "ignored" };

  if (notice.type === "payment.succeeded") {
    if (existing.status === "paid") return { outcome: "duplicate" };
    if (existing.status !== "pending" && existing.status !== "failed") {
      return { outcome: "ignored" };
    }
    if (!amountsMatch(existing, notice)) return { outcome: "mismatch" };

    const markPaid = hooks.markPaid ?? markWhopOrderPaid;
    const order = await markPaid(reference, notice.paymentId);
    if (!order) {
      const again = await lookup(reference);
      if (again?.status === "paid" || again?.whopPaymentId === notice.paymentId) {
        return { outcome: "duplicate" };
      }
      return { outcome: "ignored" };
    }
    await sendConfirmation(order, hooks);
    return { outcome: "paid", order };
  }

  if (existing.status === "failed" && existing.whopPaymentId === notice.paymentId) {
    return { outcome: "duplicate" };
  }
  if (existing.status !== "pending") return { outcome: "ignored" };

  const markFailed = hooks.markFailed ?? markWhopOrderFailed;
  const order = await markFailed(reference, notice.paymentId);
  if (!order) {
    const again = await lookup(reference);
    if (again?.status === "failed" && again.whopPaymentId === notice.paymentId) {
      return { outcome: "duplicate" };
    }
    return { outcome: "ignored" };
  }
  return { outcome: "failed", order };
}
