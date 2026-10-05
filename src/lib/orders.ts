import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import { generateOrderReference, normalizeOrderReference } from "./order-reference.ts";

export const ORDER_STATUSES = ["awaiting_payment", "pending", "paid", "failed"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderItemSnapshot = {
  slug: string;
  name: string;
  option: string | null;
  variantLabel: string | null;
  sku: string;
  qty: number;
  unitAmountCents: number;
};

export type OrderShippingSnapshot = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

export type StoredOrder = {
  reference: string;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  promoCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  items: OrderItemSnapshot[];
  shipping: OrderShippingSnapshot | null;
  createdAt: string | null;
  paidAt: string | null;
  whopPaymentId: string | null;
};

export type NewOrder = {
  currency: string;
  subtotalCents: number;
  totalCents: number;
  promoCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  items: OrderItemSnapshot[];
  shipping: OrderShippingSnapshot | null;
  status?: OrderStatus;
};

export class OrdersUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "OrdersUnavailableError";
  }
}

/** Matches db/orders.sql. Neon rejects a trailing semicolon on this endpoint. */
export const CREATE_ORDERS = `CREATE TABLE IF NOT EXISTS orders (
  reference TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  currency TEXT NOT NULL DEFAULT 'aud',
  subtotal_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  promo_code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  items JSONB NOT NULL,
  shipping JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  whop_payment_id TEXT
)`;

/** Postgres returns timestamptz in a driver-dependent shape, so pin it to ISO-8601 here. */
const ISO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

const ORDER_COLUMNS = [
  "reference",
  "status",
  "currency",
  "subtotal_cents",
  "total_cents",
  "promo_code",
  "first_name",
  "last_name",
  "email",
  "items",
  "shipping",
  `to_char(created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
  `to_char(paid_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS paid_at`,
  "whop_payment_id",
].join(", ");

const INSERT_ORDER =
  "INSERT INTO orders (reference, status, currency, subtotal_cents, total_cents, promo_code, first_name, last_name, email, items, shipping) " +
  "VALUES ($1, $11, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb) " +
  "ON CONFLICT (reference) DO NOTHING RETURNING reference";

const ADD_WHOP_PAYMENT_ID =
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS whop_payment_id TEXT";

const WHOP_PAYMENT_INDEX =
  "CREATE UNIQUE INDEX IF NOT EXISTS orders_whop_payment_id_key ON orders (whop_payment_id) WHERE whop_payment_id IS NOT NULL";

const MARK_WHOP_PAYMENT_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()), whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status <> 'paid' AND (whop_payment_id IS NULL OR whop_payment_id = $2) ` +
  `RETURNING ${ORDER_COLUMNS}`;

const MARK_WHOP_PAYMENT_FAILED =
  `UPDATE orders SET status = 'failed', whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status = 'pending' AND whop_payment_id IS NULL ` +
  `RETURNING ${ORDER_COLUMNS}`;

const SELECT_ORDER = `SELECT ${ORDER_COLUMNS} FROM orders WHERE reference = $1`;

const LIST_ORDERS = `SELECT ${ORDER_COLUMNS} FROM orders ORDER BY orders.created_at DESC LIMIT $1`;

const MARK_ORDER_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE reference = $1 ` +
  `RETURNING ${ORDER_COLUMNS}`;

export function ensureOrdersTable(sql: Sql) {
  return ensureTable(sql, "orders", CREATE_ORDERS)
    .then(() => ensureTable(sql, "orders-whop-payment-id", ADD_WHOP_PAYMENT_ID))
    .then(() => ensureTable(sql, "orders-whop-payment-index", WHOP_PAYMENT_INDEX));
}

export function ordersConfigured() {
  return getSql() !== null;
}

function readInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readTimestamp(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function readJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readItems(value: unknown): OrderItemSnapshot[] {
  const parsed = readJson(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      slug: readText(row.slug),
      name: readText(row.name) || "Research listing",
      option: typeof row.option === "string" && row.option ? row.option : null,
      variantLabel:
        typeof row.variantLabel === "string" && row.variantLabel ? row.variantLabel : null,
      sku: readText(row.sku),
      qty: readInt(row.qty),
      unitAmountCents: readInt(row.unitAmountCents),
    };
  });
}

function readShipping(value: unknown): OrderShippingSnapshot | null {
  const parsed = readJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = parsed as Record<string, unknown>;
  if (!readText(row.line1)) return null;
  return {
    name: readText(row.name),
    line1: readText(row.line1),
    line2: readText(row.line2),
    city: readText(row.city),
    state: readText(row.state),
    postcode: readText(row.postcode),
    country: readText(row.country) || "AU",
  };
}

export function readOrderRow(row: unknown): StoredOrder | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const reference = normalizeOrderReference(readText(record.reference));
  if (!reference) return null;
  const status = readText(record.status);
  return {
    reference,
    status: (ORDER_STATUSES as readonly string[]).includes(status)
      ? (status as OrderStatus)
      : "awaiting_payment",
    currency: readText(record.currency) || "aud",
    subtotalCents: readInt(record.subtotal_cents),
    totalCents: readInt(record.total_cents),
    promoCode: readText(record.promo_code) || null,
    firstName: readText(record.first_name),
    lastName: readText(record.last_name),
    email: readText(record.email),
    items: readItems(record.items),
    shipping: readShipping(record.shipping),
    createdAt: readTimestamp(record.created_at),
    paidAt: readTimestamp(record.paid_at),
    whopPaymentId: readText(record.whop_payment_id) || null,
  };
}

/**
 * Inserts the order under a freshly generated reference. `ON CONFLICT DO
 * NOTHING` makes a collision return no rows, so a retry picks a new reference
 * instead of overwriting somebody else's order.
 */
export async function insertOrder(
  order: NewOrder,
  sql: Sql | null = getSql(),
  attempts = 5,
): Promise<string> {
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const reference = generateOrderReference();
    const status = order.status ?? "awaiting_payment";
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new Error("Invalid order status");
    }
    const result = await sql.query(INSERT_ORDER, [
      reference,
      order.currency,
      order.subtotalCents,
      order.totalCents,
      order.promoCode,
      order.firstName,
      order.lastName,
      order.email,
      JSON.stringify(order.items),
      order.shipping ? JSON.stringify(order.shipping) : null,
      status,
    ]);
    if (rowsOf(result).length > 0) return reference;
  }

  throw new Error("Could not allocate an order reference");
}

export async function findOrder(
  reference: string,
  sql: Sql | null = getSql(),
): Promise<StoredOrder | null> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) return null;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(SELECT_ORDER, [normalized]);
  return readOrderRow(rowsOf(result)[0]) ?? null;
}

export async function listRecentOrders(
  limit = 50,
  sql: Sql | null = getSql(),
): Promise<StoredOrder[]> {
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const capped = Math.min(200, Math.max(1, Math.trunc(limit)));
  const result = await sql.query(LIST_ORDERS, [capped]);
  return rowsOf(result)
    .map(readOrderRow)
    .filter((order): order is StoredOrder => order !== null);
}

/**
 * First `payment.succeeded` for this Whop payment id marks the order paid.
 * A repeat of the same id, or a success after the order is already paid,
 * changes nothing and reports `transitioned: false`.
 */
export async function recordWhopPaymentSucceeded(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<{ order: StoredOrder | null; transitioned: boolean }> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentId) return { order: null, transitioned: false };
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const updated = await sql.query(MARK_WHOP_PAYMENT_PAID, [normalized, paymentId]);
  const order = readOrderRow(rowsOf(updated)[0]);
  if (order) return { order, transitioned: true };
  return { order: await findOrder(normalized, sql), transitioned: false };
}

/**
 * First `payment.failed` while the order is still pending marks it failed.
 * A paid order is left paid. Repeating the same failure is a no-op.
 */
export async function recordWhopPaymentFailed(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<{ order: StoredOrder | null; transitioned: boolean }> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentId) return { order: null, transitioned: false };
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const updated = await sql.query(MARK_WHOP_PAYMENT_FAILED, [normalized, paymentId]);
  const order = readOrderRow(rowsOf(updated)[0]);
  if (order) return { order, transitioned: true };
  return { order: await findOrder(normalized, sql), transitioned: false };
}

/** Idempotent: re-posting keeps the original paid_at. */
export async function markOrderPaid(
  reference: string,
  sql: Sql | null = getSql(),
): Promise<StoredOrder | null> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) return null;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(MARK_ORDER_PAID, [normalized]);
  return readOrderRow(rowsOf(result)[0]) ?? null;
}
