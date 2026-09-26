import { randomBytes } from "node:crypto";
import type { ResolvedLine } from "@/lib/order";

export type PaymentMethod = "card" | "bank_transfer";
export type PaymentStatus = "pending" | "paid" | "failed";

export type OrderShipping = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
};

export type StoredOrder = {
  id: string;
  status: PaymentStatus;
  email: string;
  firstName: string;
  lastName: string;
  currency: "aud";
  subtotalCents: number;
  volumeDiscountCents: number;
  promoCode: string;
  promoDiscountCents: number;
  totalCents: number;
  lines: ResolvedLine[];
  shipping: OrderShipping | null;
  paymentMethod: PaymentMethod;
  whopCheckoutId: string | null;
  whopPaymentId: string | null;
  confirmationSentAt: string | null;
  createdAt: string;
};

export type NewOrder = Omit<StoredOrder, "whopCheckoutId" | "whopPaymentId" | "confirmationSentAt" | "createdAt" | "status"> & {
  status?: PaymentStatus;
};

export type OrderStore = {
  insert(order: NewOrder): Promise<StoredOrder>;
  get(id: string): Promise<StoredOrder | null>;
  attachCheckout(id: string, checkoutId: string): Promise<void>;
  getByCheckout(checkoutId: string): Promise<StoredOrder | null>;
  markPaid(id: string, paymentId: string): Promise<StoredOrder | null>;
  markFailed(id: string, paymentId: string): Promise<StoredOrder | null>;
  claimConfirmation(id: string, paymentId: string): Promise<boolean>;
  releaseConfirmation(id: string, paymentId: string): Promise<void>;
};

export function newOrderId() {
  return `ord_${randomBytes(12).toString("hex")}`;
}

export function createMemoryOrderStore(): OrderStore {
  const orders = new Map<string, StoredOrder>();

  return {
    async insert(order) {
      const stored: StoredOrder = {
        ...order,
        status: "pending",
        whopCheckoutId: null,
        whopPaymentId: null,
        confirmationSentAt: null,
        createdAt: new Date().toISOString(),
      };
      orders.set(stored.id, stored);
      return stored;
    },
    async get(id) {
      return orders.get(id) ?? null;
    },
    async attachCheckout(id, checkoutId) {
      const order = orders.get(id);
      if (order) order.whopCheckoutId = checkoutId;
    },
    async getByCheckout(checkoutId) {
      for (const order of orders.values()) {
        if (order.whopCheckoutId === checkoutId) return order;
      }
      return null;
    },
    async markPaid(id, paymentId) {
      const order = orders.get(id);
      if (!order) return null;
      if (order.status === "paid") return order;
      order.status = "paid";
      order.whopPaymentId = paymentId;
      return order;
    },
    async markFailed(id, paymentId) {
      const order = orders.get(id);
      if (!order || order.status === "paid") return order ?? null;
      if (order.status === "failed" && order.whopPaymentId === paymentId) return order;
      order.status = "failed";
      order.whopPaymentId = paymentId;
      return order;
    },
    async claimConfirmation(id, paymentId) {
      const order = orders.get(id);
      if (!order || order.whopPaymentId !== paymentId || order.confirmationSentAt) return false;
      order.confirmationSentAt = new Date().toISOString();
      return true;
    },
    async releaseConfirmation(id, paymentId) {
      const order = orders.get(id);
      if (order && order.whopPaymentId === paymentId) order.confirmationSentAt = null;
    },
  };
}

export type WhopPaymentNotice = {
  type?: string;
  event?: string;
  data?: {
    id?: string;
    metadata?: Record<string, unknown> | null;
    checkout_configuration_id?: string | null;
  };
};

export function noticeOrderId(event: WhopPaymentNotice) {
  const metadata = event.data?.metadata;
  if (!metadata) return "";
  const value = metadata.orderId ?? metadata.order_id;
  return typeof value === "string" ? value : "";
}

export async function applyWhopPayment(
  store: OrderStore,
  event: WhopPaymentNotice,
  sendEmail: (order: StoredOrder) => Promise<void>,
) {
  const name = event.type || event.event || "";
  const paymentId = event.data?.id ?? "";
  if (name !== "payment.succeeded" && name !== "payment.failed") {
    return { outcome: "ignored" as const };
  }
  const checkoutId = event.data?.checkout_configuration_id ?? "";
  const metadataOrderId = noticeOrderId(event);
  if (!paymentId || (!metadataOrderId && !checkoutId)) return { outcome: "ignored" as const };

  const existing = metadataOrderId
    ? await store.get(metadataOrderId)
    : await store.getByCheckout(checkoutId);
  if (!existing) return { outcome: "missing" as const };
  const orderId = existing.id;

  if (name === "payment.failed") {
    if (existing.status === "paid") return { outcome: "ignored" as const };
    if (existing.status === "failed" && existing.whopPaymentId === paymentId) {
      return { outcome: "already" as const };
    }
    await store.markFailed(orderId, paymentId);
    return { outcome: "failed" as const };
  }

  if (existing.status === "paid" && existing.whopPaymentId && existing.whopPaymentId !== paymentId) {
    return { outcome: "ignored" as const };
  }
  if (existing.whopPaymentId === paymentId && existing.confirmationSentAt) {
    return { outcome: "already" as const };
  }
  if (existing.status !== "paid") {
    await store.markPaid(orderId, paymentId);
  }
  const claimed = await store.claimConfirmation(orderId, paymentId);
  if (!claimed) return { outcome: "already" as const };
  try {
    const paid = await store.get(orderId);
    if (!paid) return { outcome: "missing" as const };
    await sendEmail(paid);
  } catch (error) {
    await store.releaseConfirmation(orderId, paymentId);
    throw error;
  }
  return { outcome: "paid" as const };
}
