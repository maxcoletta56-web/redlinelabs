import { randomBytes } from "node:crypto";
import type { ResolvedLine } from "./order.ts";

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

export type NewOrder = Omit<
  StoredOrder,
  "status" | "whopCheckoutId" | "whopPaymentId" | "confirmationSentAt" | "createdAt"
>;

export type OrderStore = {
  insert(order: NewOrder): Promise<StoredOrder>;
  get(id: string): Promise<StoredOrder | null>;
  attachCheckout(id: string, checkoutId: string): Promise<void>;
  markPaid(id: string, paymentId: string): Promise<StoredOrder | null>;
  markFailed(id: string, paymentId: string): Promise<StoredOrder | null>;
  claimConfirmation(id: string, paymentId: string): Promise<boolean>;
  releaseConfirmation(id: string, paymentId: string): Promise<void>;
};

export function newOrderId() {
  return `ord_${randomBytes(12).toString("hex")}`;
}

export function isOrderId(value: string) {
  return /^ord_[a-f0-9]{24}$/.test(value);
}

export function publicOrder(order: StoredOrder) {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
  };
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
      return structuredClone(stored);
    },
    async get(id) {
      const order = orders.get(id);
      return order ? structuredClone(order) : null;
    },
    async attachCheckout(id, checkoutId) {
      const order = orders.get(id);
      if (order) order.whopCheckoutId = checkoutId;
    },
    async markPaid(id, paymentId) {
      const order = orders.get(id);
      if (!order) return null;
      if (order.status === "paid") return structuredClone(order);
      order.status = "paid";
      order.whopPaymentId = paymentId;
      return structuredClone(order);
    },
    async markFailed(id, paymentId) {
      const order = orders.get(id);
      if (!order || order.status === "paid") return order ? structuredClone(order) : null;
      if (order.status === "failed" && order.whopPaymentId === paymentId) return structuredClone(order);
      order.status = "failed";
      order.whopPaymentId = paymentId;
      return structuredClone(order);
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
