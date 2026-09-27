import { getSql, type Sql } from "./comments.ts";
import {
  isOrderId,
  type NewOrder,
  type OrderStore,
  type PaymentMethod,
  type PaymentStatus,
  type StoredOrder,
} from "./orders.ts";
import { CREATE_SHOP_ORDERS } from "./shop-orders-sql.ts";

export { CREATE_SHOP_ORDERS };

export class OrdersUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "OrdersUnavailableError";
  }
}

const ready = new WeakMap<Sql, Promise<void>>();

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: unknown[] }).rows;
  }
  return [];
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readLines(value: unknown): StoredOrder["lines"] {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? []);
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredOrder["lines"]) : [];
  } catch {
    return [];
  }
}

function readShipping(value: unknown): StoredOrder["shipping"] {
  if (value == null || value === "") return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  try {
    const parsed = JSON.parse(text) as StoredOrder["shipping"];
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function rowToOrder(row: unknown): StoredOrder | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = readString(record.id);
  const status = readString(record.status);
  const paymentMethod = readString(record.payment_method);
  if (!id || (status !== "pending" && status !== "paid" && status !== "failed")) return null;
  if (paymentMethod !== "card" && paymentMethod !== "bank_transfer") return null;
  return {
    id,
    status,
    email: readString(record.email),
    firstName: readString(record.first_name),
    lastName: readString(record.last_name),
    currency: "aud",
    subtotalCents: Number(record.subtotal_cents),
    volumeDiscountCents: Number(record.volume_discount_cents),
    promoCode: readString(record.promo_code),
    promoDiscountCents: Number(record.promo_discount_cents),
    totalCents: Number(record.total_cents),
    lines: readLines(record.lines),
    shipping: readShipping(record.shipping),
    paymentMethod,
    whopCheckoutId: readString(record.whop_checkout_id) || null,
    whopPaymentId: readString(record.whop_payment_id) || null,
    confirmationSentAt: readString(record.confirmation_sent_at) || null,
    createdAt: readString(record.created_at),
  };
}

async function ensureShopOrders(sql: Sql) {
  let pending = ready.get(sql);
  if (!pending) {
    pending = sql
      .query(CREATE_SHOP_ORDERS)
      .then(() => undefined)
      .catch((error: unknown) => {
        ready.delete(sql);
        throw error;
      });
    ready.set(sql, pending);
  }
  await pending;
}

const SELECT_BY_ID = "SELECT * FROM shop_orders WHERE id = $1";

export function createNeonOrderStore(sql: Sql): OrderStore {
  const prepare = () => ensureShopOrders(sql);

  return {
    async insert(order: NewOrder) {
      await prepare();
      const createdAt = new Date().toISOString();
      await sql.query(
        "INSERT INTO shop_orders (id, status, email, first_name, last_name, currency, subtotal_cents, volume_discount_cents, promo_code, promo_discount_cents, total_cents, lines, shipping, payment_method, whop_checkout_id, whop_payment_id, confirmation_sent_at, created_at) VALUES ($1, 'pending', $2, $3, $4, 'aud', $5, $6, $7, $8, $9, $10, $11, $12, NULL, NULL, NULL, $13)",
        [
          order.id,
          order.email,
          order.firstName,
          order.lastName,
          order.subtotalCents,
          order.volumeDiscountCents,
          order.promoCode,
          order.promoDiscountCents,
          order.totalCents,
          JSON.stringify(order.lines),
          order.shipping ? JSON.stringify(order.shipping) : null,
          order.paymentMethod,
          createdAt,
        ],
      );
      const saved = await sql.query(SELECT_BY_ID, [order.id]);
      const stored = rowToOrder(rowsOf(saved)[0]);
      if (!stored) throw new Error("Order was not saved");
      return stored;
    },
    async get(id) {
      if (!isOrderId(id)) return null;
      await prepare();
      const result = await sql.query(SELECT_BY_ID, [id]);
      return rowToOrder(rowsOf(result)[0]);
    },
    async attachCheckout(id, checkoutId) {
      await prepare();
      await sql.query("UPDATE shop_orders SET whop_checkout_id = $2 WHERE id = $1", [id, checkoutId]);
    },
    async markPaid(id, paymentId) {
      await prepare();
      await sql.query(
        "UPDATE shop_orders SET status = 'paid', whop_payment_id = $2 WHERE id = $1 AND status <> 'paid'",
        [id, paymentId],
      );
      return this.get(id);
    },
    async markFailed(id, paymentId) {
      await prepare();
      await sql.query(
        "UPDATE shop_orders SET status = 'failed', whop_payment_id = $2 WHERE id = $1 AND status <> 'paid' AND NOT (status = 'failed' AND whop_payment_id = $2)",
        [id, paymentId],
      );
      return this.get(id);
    },
    async claimConfirmation(id, paymentId) {
      await prepare();
      const result = await sql.query(
        "UPDATE shop_orders SET confirmation_sent_at = $3 WHERE id = $1 AND whop_payment_id = $2 AND confirmation_sent_at IS NULL RETURNING id",
        [id, paymentId, new Date().toISOString()],
      );
      return rowsOf(result).length > 0;
    },
    async releaseConfirmation(id, paymentId) {
      await prepare();
      await sql.query(
        "UPDATE shop_orders SET confirmation_sent_at = NULL WHERE id = $1 AND whop_payment_id = $2",
        [id, paymentId],
      );
    },
  };
}

export async function getOrderStore() {
  const sql = getSql();
  if (!sql) throw new OrdersUnavailableError();
  return createNeonOrderStore(sql);
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return value === "pending" || value === "paid" || value === "failed";
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "card" || value === "bank_transfer";
}
