import { normalizeOrderReference } from "@/lib/order-reference";
import { applyWhopPayment, type StoredOrder, type WhopSettlement } from "@/lib/orders";
import { WhopSignatureError, unwrapWhopWebhook } from "@/lib/whop-signature";

export type WhopWebhookDeps = {
  secret: string | undefined;
  nowSeconds?: number;
  applyPayment?: (
    reference: string,
    paymentId: string,
    outcome: "paid" | "failed" | "action_required",
  ) => Promise<WhopSettlement>;
  sendConfirmation?: (order: StoredOrder) => Promise<void>;
  sendRecovery?: (order: StoredOrder, recoveryUrl: string) => Promise<void>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Dashboard subscriptions are named with underscores (`payment_succeeded`,
 * `payment_requires_action`). The payload uses a dot after the resource
 * (`payment.succeeded`, `payment.requires_action`). Only the first underscore
 * is the separator, so `requires_action` keeps its underscore.
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
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return null;
  const recovery = typeof row.recovery_url === "string" ? row.recovery_url.trim() : "";
  return { id, orderId: readOrderId(row.metadata), recoveryUrl: recovery };
}

/** Off-session 3DS recovery links are Whop-hosted. Anything else is ignored. */
export function whopRecoveryUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host !== "whop.com" && !host.endsWith(".whop.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Verifies the raw body, then settles the order named by `metadata.orderId`.
 * `payment.succeeded` marks it paid and sends the confirmation once per Whop
 * payment id. `payment.failed` marks it failed. `payment.requires_action`
 * emails the recovery link so the buyer can finish 3D Secure off-session.
 * On-session challenges are completed inside the embedded element.
 */
export async function receiveWhopWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | null | undefined>,
  deps: WhopWebhookDeps,
): Promise<{ status: number }> {
  let event: unknown;
  try {
    event = unwrapWhopWebhook(rawBody, headers, deps.secret, deps.nowSeconds);
  } catch (error) {
    if (error instanceof WhopSignatureError) return { status: 401 };
    return { status: 400 };
  }

  const record = asRecord(event);
  const type = typeof record?.type === "string" ? normalizeWhopEventType(record.type) : "";
  if (type !== "payment.succeeded" && type !== "payment.failed" && type !== "payment.requires_action") {
    return { status: 200 };
  }

  const payment = readPayment(record?.data);
  if (!payment?.orderId) {
    console.error("[whop] webhook payment had no orderId metadata", { type });
    return { status: 200 };
  }

  const outcome =
    type === "payment.succeeded" ? "paid" : type === "payment.failed" ? "failed" : "action_required";
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
      await deps.sendConfirmation?.(settlement.order);
    } catch (error) {
      console.error("[whop] confirmation email failed", {
        reference: settlement.order.reference,
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  if (settlement.outcome === "action_required" && settlement.transitioned) {
    const recoveryUrl = whopRecoveryUrl(payment.recoveryUrl);
    if (recoveryUrl) {
      try {
        await deps.sendRecovery?.(settlement.order, recoveryUrl);
      } catch (error) {
        console.error("[whop] 3DS recovery email failed", {
          reference: settlement.order.reference,
          errorName: error instanceof Error ? error.name : "unknown",
        });
      }
    }
  }

  return { status: 200 };
}
