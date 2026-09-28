import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import { generateOrderReference, normalizeOrderReference } from "./order-reference.ts";

export const ORDER_STATUSES = ["awaiting_payment", "pending", "paid", "failed"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_METHODS = ["bank_transfer", "card"] as const;

export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

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
  volumeDiscountCents: number;
  paymentMethod: OrderPaymentMethod;
  whopCheckoutId: string | null;
  whopPaymentId: string | null;
  createdAt: string | null;
  paidAt: string | null;
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
  volumeDiscountCents?: number;
  paymentMethod?: OrderPaymentMethod;
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
  volume_discount_cents INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  whop_checkout_id TEXT,
  whop_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
)`;

/**
 * Existing databases already have the original orders table. Each statement
 * is separate because Neon’s HTTP SQL endpoint accepts one statement.
 */
export const ORDERS_MIGRATIONS = [
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS volume_discount_cents INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'bank_transfer'",
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS whop_checkout_id TEXT",
  "ALTER TABLE orders ADD COLUMN IF NOT EXISTS whop_payment_id TEXT",
  `CREATE TABLE IF NOT EXISTS whop_payment_receipts (
  payment_id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
] as const;

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
  "volume_discount_cents",
  "payment_method",
  "whop_checkout_id",
  "whop_payment_id",
  `to_char(created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
  `to_char(paid_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS paid_at`,
].join(", ");

const INSERT_ORDER =
  "INSERT INTO orders (reference, status, currency, subtotal_cents, total_cents, promo_code, first_name, last_name, email, items, shipping, volume_discount_cents, payment_method) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13) " +
  "ON CONFLICT (reference) DO NOTHING RETURNING reference";

const SELECT_ORDER = `SELECT ${ORDER_COLUMNS} FROM orders WHERE reference = $1`;

const LIST_ORDERS = `SELECT ${ORDER_COLUMNS} FROM orders ORDER BY orders.created_at DESC LIMIT $1`;

const MARK_ORDER_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE reference = $1 ` +
  `RETURNING ${ORDER_COLUMNS}`;

const MARK_CARD_ORDER_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()), whop_payment_id = $2 ` +
  `WHERE reference = $1 AND payment_method = 'card' AND status IN ('pending', 'failed') ` +
  `RETURNING ${ORDER_COLUMNS}`;

const MARK_CARD_ORDER_FAILED =
  `UPDATE orders SET status = 'failed' ` +
  `WHERE reference = $1 AND payment_method = 'card' AND status = 'pending' ` +
  `RETURNING ${ORDER_COLUMNS}`;

const ATTACH_WHOP_CHECKOUT =
  "UPDATE orders SET whop_checkout_id = $2 WHERE reference = $1 AND payment_method = 'card'";

const INSERT_WHOP_RECEIPT =
  "INSERT INTO whop_payment_receipts (payment_id, order_reference, outcome) " +
  "VALUES ($1, $2, $3) ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id";

const UPGRADE_WHOP_RECEIPT =
  "UPDATE whop_payment_receipts SET outcome = 'paid' WHERE payment_id = $1 AND outcome = 'failed' RETURNING payment_id";

export function ensureOrdersTable(sql: Sql) {
  return ORDERS_MIGRATIONS.reduce<Promise<void>>(
    (pending, statement, index) =>
      pending.then(() => ensureTable(sql, `orders-migration-${index}`, statement).then(() => undefined)),
    ensureTable(sql, "orders", CREATE_ORDERS).then(() => undefined),
  );
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
    volumeDiscountCents: readInt(record.volume_discount_cents),
    paymentMethod: readText(record.payment_method) === "card" ? "card" : "bank_transfer",
    whopCheckoutId: readText(record.whop_checkout_id) || null,
    whopPaymentId: readText(record.whop_payment_id) || null,
    createdAt: readTimestamp(record.created_at),
    paidAt: readTimestamp(record.paid_at),
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
    const result = await sql.query(INSERT_ORDER, [
      reference,
      order.status ?? "awaiting_payment",
      order.currency,
      order.subtotalCents,
      order.totalCents,
      order.promoCode,
      order.firstName,
      order.lastName,
      order.email,
      JSON.stringify(order.items),
      order.shipping ? JSON.stringify(order.shipping) : null,
      order.volumeDiscountCents ?? 0,
      order.paymentMethod ?? "bank_transfer",
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

export async function markCardOrderPaid(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<StoredOrder | null> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentId) return null;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(MARK_CARD_ORDER_PAID, [normalized, paymentId]);
  return readOrderRow(rowsOf(result)[0]) ?? null;
}

export async function markCardOrderFailed(
  reference: string,
  sql: Sql | null = getSql(),
): Promise<StoredOrder | null> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) return null;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(MARK_CARD_ORDER_FAILED, [normalized]);
  return readOrderRow(rowsOf(result)[0]) ?? null;
}

export async function attachWhopCheckout(
  reference: string,
  checkoutId: string,
  sql: Sql | null = getSql(),
): Promise<void> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !checkoutId || !sql) return;
  await ensureOrdersTable(sql);
  await sql.query(ATTACH_WHOP_CHECKOUT, [normalized, checkoutId]);
}

/** First writer for a Whop payment id wins. A later success can upgrade a failure. */
export async function claimWhopPayment(
  paymentId: string,
  reference: string,
  outcome: "paid" | "failed" | "rejected",
  sql: Sql,
): Promise<"new" | "upgraded" | "duplicate"> {
  await ensureOrdersTable(sql);
  const inserted = await sql.query(INSERT_WHOP_RECEIPT, [paymentId, reference, outcome]);
  if (rowsOf(inserted).length > 0) return "new";
  if (outcome !== "paid") return "duplicate";
  const upgraded = await sql.query(UPGRADE_WHOP_RECEIPT, [paymentId]);
  return rowsOf(upgraded).length > 0 ? "upgraded" : "duplicate";
}
