import { commentsDatabaseUrl, neonQuery } from "../../scripts/ensure-comments-table.mjs";
import type { ShippingAddressInput } from "./checkout-session.ts";
import type { ResolvedLine } from "./order.ts";
import { sendOrderConfirmation } from "./order-email.ts";

export type OrderStatus = "pending" | "paid" | "failed";

export type StoredOrder = {
  id: string;
  email: string;
  status: OrderStatus;
  currency: "aud";
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  lines: ResolvedLine[];
  shipping: ShippingAddressInput | null;
  promoCode: string;
  whopCheckoutId: string | null;
  whopPaymentId: string | null;
  confirmationSent: boolean;
  createdAt: string;
};

export type OrderStore = {
  save(order: StoredOrder): Promise<void>;
  update(order: StoredOrder): Promise<void>;
  find(id: string): Promise<StoredOrder | null>;
  recordPayment(
    paymentId: string,
    orderId: string,
    eventType: string,
  ): Promise<"inserted" | "duplicate">;
};

export type PaymentApplyResult =
  | { outcome: "paid" | "failed" | "duplicate" | "ignored" | "missing" | "mismatch" };

type PaymentInput = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
  amountCents: number | null;
  currency: string | null;
};

export function createMemoryOrderStore(): OrderStore {
  const orders = new Map<string, StoredOrder>();
  const payments = new Map<string, string>();
  return {
    async save(order) {
      orders.set(order.id, structuredClone(order));
    },
    async update(order) {
      orders.set(order.id, structuredClone(order));
    },
    async find(id) {
      const order = orders.get(id);
      return order ? structuredClone(order) : null;
    },
    async recordPayment(paymentId, orderId, eventType) {
      if (payments.has(paymentId)) return "duplicate";
      payments.set(paymentId, `${orderId}:${eventType}`);
      return "inserted";
    },
  };
}

let memorySingleton: OrderStore | null = null;
let storeOverride: OrderStore | null = null;

export function memoryOrderStore() {
  memorySingleton ??= createMemoryOrderStore();
  return memorySingleton;
}

export function setOrderStoreForTests(store: OrderStore | null) {
  storeOverride = store;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function neonRows(result: unknown): Record<string, unknown>[] {
  const body = asRecord(result);
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  const fields = Array.isArray(body?.fields) ? body.fields : [];
  const names = fields.map((field) => readString(asRecord(field)?.name));
  return rows.map((row) => {
    if (Array.isArray(row)) {
      return Object.fromEntries(names.map((name, index) => [name, row[index]]));
    }
    return asRecord(row) ?? {};
  });
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBool(value: unknown) {
  return value === true || value === "t" || value === "true" || value === 1;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const ORDER_COLUMNS = [
  "id",
  "email",
  "status",
  "currency",
  "subtotal_cents",
  "discount_cents",
  "total_cents",
  "lines",
  "shipping",
  "promo_code",
  "whop_checkout_id",
  "whop_payment_id",
  "confirmation_sent",
  "created_at",
] as const;

function rowToOrder(row: Record<string, unknown>): StoredOrder | null {
  const id = readString(row.id);
  const email = readString(row.email);
  const status = readString(row.status);
  if (!id || !email || (status !== "pending" && status !== "paid" && status !== "failed")) return null;
  const created = row.created_at;
  return {
    id,
    email,
    status,
    currency: "aud",
    subtotalCents: Number(row.subtotal_cents) || 0,
    discountCents: Number(row.discount_cents) || 0,
    totalCents: Number(row.total_cents) || 0,
    lines: parseJson<ResolvedLine[]>(row.lines, []),
    shipping: parseJson<ShippingAddressInput | null>(row.shipping, null),
    promoCode: readString(row.promo_code),
    whopCheckoutId: readString(row.whop_checkout_id) || null,
    whopPaymentId: readString(row.whop_payment_id) || null,
    confirmationSent: readBool(row.confirmation_sent),
    createdAt: created instanceof Date ? created.toISOString() : readString(created) || new Date(0).toISOString(),
  };
}

function orderParams(order: StoredOrder) {
  return [
    order.id,
    order.email,
    order.status,
    order.currency,
    order.subtotalCents,
    order.discountCents,
    order.totalCents,
    JSON.stringify(order.lines),
    order.shipping ? JSON.stringify(order.shipping) : null,
    order.promoCode,
    order.whopCheckoutId,
    order.whopPaymentId,
    order.confirmationSent,
    order.createdAt,
  ];
}

export function neonOrderStore(connectionString: string): OrderStore {
  return {
    async save(order) {
      await neonQuery(
        connectionString,
        `INSERT INTO orders (${ORDER_COLUMNS.join(", ")}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        orderParams(order),
      );
    },
    async update(order) {
      await neonQuery(
        connectionString,
        `UPDATE orders SET email = $2, status = $3, currency = $4, subtotal_cents = $5, discount_cents = $6, total_cents = $7, lines = $8, shipping = $9, promo_code = $10, whop_checkout_id = $11, whop_payment_id = $12, confirmation_sent = $13 WHERE id = $1`,
        orderParams(order),
      );
    },
    async find(id) {
      const result = await neonQuery(
        connectionString,
        `SELECT ${ORDER_COLUMNS.join(", ")} FROM orders WHERE id = $1`,
        [id],
      );
      const row = neonRows(result)[0];
      return row ? rowToOrder(row) : null;
    },
    async recordPayment(paymentId, orderId, eventType) {
      const result = await neonQuery(
        connectionString,
        `INSERT INTO whop_payment_events (payment_id, order_id, event_type) VALUES ($1, $2, $3) ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id`,
        [paymentId, orderId, eventType],
      );
      return neonRows(result).length > 0 ? "inserted" : "duplicate";
    },
  };
}

export function getOrderStore() {
  if (storeOverride) return storeOverride;
  const connectionString = commentsDatabaseUrl();
  if (connectionString) return neonOrderStore(connectionString);
  return memoryOrderStore();
}

function amountMatches(order: StoredOrder, input: PaymentInput) {
  if (input.currency && input.currency.toLowerCase() !== order.currency) return false;
  if (input.amountCents != null && input.amountCents !== order.totalCents) return false;
  return true;
}

export async function applyWhopPayment(
  store: OrderStore,
  input: PaymentInput,
  sendEmail: (order: StoredOrder) => Promise<void> = sendOrderConfirmation,
): Promise<PaymentApplyResult> {
  const order = await store.find(input.orderId);
  if (!order) return { outcome: "missing" };

  if (input.type === "payment.succeeded") {
    if (!amountMatches(order, input)) {
      await store.recordPayment(input.paymentId, order.id, "payment.succeeded.mismatch");
      return { outcome: "mismatch" };
    }
    const recorded = await store.recordPayment(input.paymentId, order.id, input.type);
    const current = (await store.find(order.id)) ?? order;
    if (recorded === "duplicate") {
      if (current.status === "paid" && !current.confirmationSent) {
        await sendEmail(current);
        current.confirmationSent = true;
        await store.update(current);
        return { outcome: "paid" };
      }
      return { outcome: "duplicate" };
    }
    if (current.status !== "paid") {
      current.status = "paid";
      current.whopPaymentId = input.paymentId;
    }
    await store.update(current);
    if (!current.confirmationSent) {
      await sendEmail(current);
      current.confirmationSent = true;
      await store.update(current);
    }
    return { outcome: "paid" };
  }

  if (order.status === "paid") {
    await store.recordPayment(input.paymentId, order.id, input.type);
    return { outcome: "ignored" };
  }
  const recorded = await store.recordPayment(input.paymentId, order.id, input.type);
  if (recorded === "duplicate") return { outcome: "duplicate" };
  order.status = "failed";
  order.whopPaymentId = input.paymentId;
  await store.update(order);
  return { outcome: "failed" };
}
