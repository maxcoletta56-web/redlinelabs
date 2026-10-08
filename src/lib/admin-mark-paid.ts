import {
  OrderCancelledError,
  markOrderPaidWithPaymentEmail,
  type MarkPaidEmailHooks,
} from "./orders.ts";

export type AdminMarkPaidSettlement = {
  notice: "paid" | "missing" | "failed" | "blocked";
  location: string;
};

/**
 * Desk result for mark-paid. The bearer route maps the same update to JSON;
 * both call `markOrderPaidWithPaymentEmail`. A mail failure stays on the paid
 * redirect. Only a thrown status update becomes `notice=failed`.
 */
export async function settleAdminOrderPaid(
  reference: string,
  hooks?: MarkPaidEmailHooks,
): Promise<AdminMarkPaidSettlement> {
  let failed = false;
  let found = false;
  try {
    found = (await markOrderPaidWithPaymentEmail(reference, hooks)) !== null;
  } catch (error) {
    if (error instanceof OrderCancelledError) {
      return { notice: "blocked", location: "/admin/orders?notice=blocked" };
    }
    failed = true;
    console.error("[admin] mark order paid failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
  if (failed) return { notice: "failed", location: "/admin/orders?notice=failed" };
  if (!found) return { notice: "missing", location: "/admin/orders?notice=missing" };
  return {
    notice: "paid",
    location: `/admin/orders?notice=paid&reference=${encodeURIComponent(reference)}`,
  };
}
