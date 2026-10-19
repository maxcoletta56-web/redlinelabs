import { normalizeOrderReference } from "@/lib/order-reference";
import {
  applyWhopPayment,
  markOrderPaidWithPaymentEmail,
  type StoredOrder,
  type WhopSettlement,
} from "@/lib/orders";
import { WhopSignatureError, unwrapWhopWebhook } from "@/lib/whop-signature";

export type WhopWebhookDeps = {
  secret: string | undefined;
  nowSeconds?: number;
  applyPayment?: (reference: string, paymentId: string, outcome: "paid" | "failed") => Promise<WhopSettlement>;
  sendConfirmation?: (order: StoredOrder) => Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Dashboard subscriptions are named with underscores (`payment_succeeded`).
 * The payload uses a dot (`payment.succeeded`). Only the first underscore is
 * the separator, so `requires_action` keeps its underscore.
 */
export function normalizeWhopEventType(type: string) {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes(".")) return normalized;
  const separator = normalized.indexOf("_");
  if (separator === -1) return normalized;
  return `${normalized.slice(0, separator)}.${normalized.slice(separator + 1)}`;
}

function readOrderId(metadata: unknown) {
  const row = asRecord(metadata);
  if (!row) return null;
  const value = row.orderId ?? row.order_id;
  return typeof value === "string" ? normalizeOrderReference(value) : null;
}

function readPayment(data: unknown) {
  const row = asRecord(data);
  if (!row) return null;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!/^pay_[A-Za-z0-9_-]{4,80}$/.test(id)) return null;
  return { id, orderId: readOrderId(row.metadata) };
}

/**
 * Verifies the raw body, then settles the order named by `metadata.orderId`.
 * `payment.succeeded` marks it paid and sends the confirmation once per Whop
 * payment id. `payment.failed` marks an unpaid order failed. The same payment
 * id is a no-op. On-session 3D Secure is finished by the embedded element via
 * `payments.handleNextAction`; this route does not trust a browser status.
 */
export async function receiveWhopWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | null | undefined>,
  deps: WhopWebhookDeps,
): Promise<{ status: number }> {
  if (!deps.secret?.trim()) return { status: 503 };

  let event: unknown;
  try {
    event = unwrapWhopWebhook(rawBody, headers, deps.secret, deps.nowSeconds);
  } catch (error) {
    if (error instanceof WhopSignatureError) return { status: 401 };
    return { status: 400 };
  }

  const record = asRecord(event);
  const type = typeof record?.type === "string" ? normalizeWhopEventType(record.type) : "";
  if (type !== "payment.succeeded" && type !== "payment.failed") {
    return { status: 200 };
  }

  const payment = readPayment(record?.data);
  if (!payment?.orderId) {
    console.error("[whop] webhook payment had no orderId metadata", { type });
    return { status: 200 };
  }

  const outcome = type === "payment.succeeded" ? "paid" : "failed";
  let settlement: WhopSettlement;
  try {
    settlement = await (deps.applyPayment ?? applyWhopPayment)(payment.orderId, payment.id, outcome);
  } catch (error) {
    console.error("[whop] webhook settlement failed", {
      reference: payment.orderId,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { status: 500 };
  }

  if (settlement.outcome === "paid" && settlement.transitioned) {
    try {
      if (deps.sendConfirmation) {
        await deps.sendConfirmation(settlement.order);
      } else {
        await markOrderPaidWithPaymentEmail(settlement.order.reference, {
          findOrder: async () => ({ ...settlement.order, status: "pending" }),
          markOrderPaid: async () => settlement.order,
        });
      }
    } catch (error) {
      console.error("[whop] confirmation email failed", {
        reference: settlement.order.reference,
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return { status: 200 };
}
