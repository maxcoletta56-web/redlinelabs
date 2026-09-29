import "server-only";

import { paymentReceivedEmailDue } from "@/lib/admin-orders";
import { sendPaymentReceivedEmail } from "@/lib/mailer";
import { findOrder, markOrderPaid, type StoredOrder } from "@/lib/orders";
import { scheduleEmail } from "@/lib/schedule-email";

export type RecordedAdminPayment =
  | { ok: true; order: StoredOrder }
  | { ok: false; reason: "missing" | "failed" };

function errorFields(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Marks a bank-transfer order paid and schedules the payment email once.
 * The admin desk and POST /api/admin/orders/[reference]/paid both use this.
 */
export async function recordAdminPayment(reference: string): Promise<RecordedAdminPayment> {
  try {
    const existing = await findOrder(reference).catch((error: unknown) => {
      console.error("[admin] order lookup before paid email failed", {
        reference,
        ...errorFields(error),
      });
      return null;
    });
    const order = await markOrderPaid(reference);
    if (!order) return { ok: false, reason: "missing" };
    if (paymentReceivedEmailDue(existing?.status)) {
      scheduleEmail(order.reference, () =>
        sendPaymentReceivedEmail({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          totalCents: order.totalCents,
        }),
      );
    }
    return { ok: true, order };
  } catch (error) {
    console.error("[admin] mark order paid failed", {
      reference,
      ...errorFields(error),
    });
    return { ok: false, reason: "failed" };
  }
}
