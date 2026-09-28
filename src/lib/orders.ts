import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import { generateOrderReference, normalizeOrderReference } from "./order-reference.ts";

export const ORDER_STATUSES = ["awaiting_payment", "pending", "paid", "failed"] as const;

export const PAYMENT_METHODS = ["bank_transfer", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
  paymentMethod: PaymentMethod;
  whopPaymentId: string | null;
  confirmationSentAt: string | null;
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
  status?: "awaiting_payment" | "pending";
  paymentMethod?: PaymentMethod;
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
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  whop_payment_id TEXT UNIQUE,
  confirmation_sent_at TIMESTAMPTZ
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
  "payment_method",
  "whop_payment_id",
  `to_char(confirmation_sent_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS confirmation_sent_at`,
].join(", ");

const INSERT_ORDER =
  "INSERT INTO orders (reference, status, currency, subtotal_cents, total_cents, promo_code, first_name, last_name, email, items, shipping, payment_method) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12) " +
  "ON CONFLICT (reference) DO NOTHING RETURNING reference";

const SELECT_ORDER = `SELECT ${ORDER_COLUMNS} FROM orders WHERE reference = $1`;

const LIST_ORDERS = `SELECT ${ORDER_COLUMNS} FROM orders ORDER BY orders.created_at DESC LIMIT $1`;

const MARK_ORDER_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE reference = $1 ` +
  `RETURNING ${ORDER_COLUMNS}`;

export function ensureOrdersTable(sql: Sql) {
  return ensureTable(sql, "orders", CREATE_ORDERS);
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
    paymentMethod: readText(record.payment_method) === "card" ? "card" : "bank_transfer",
    whopPaymentId: readText(record.whop_payment_id) || null,
    confirmationSentAt: readTimestamp(record.confirmation_sent_at),
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
    const status = order.status === "pending" ? "pending" : "awaiting_payment";
    const paymentMethod = order.paymentMethod === "card" ? "card" : "bank_transfer";
    const result = await sql.query(INSERT_ORDER, [
      reference,
      status,
      order.currency,
      order.subtotalCents,
      order.totalCents,
      order.promoCode,
      order.firstName,
      order.lastName,
      order.email,
      JSON.stringify(order.items),
      order.shipping ? JSON.stringify(order.shipping) : null,
      paymentMethod,
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

const MARK_WHOP_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()), whop_payment_id = $2 ` +
  `WHERE reference = $1 AND (whop_payment_id IS NULL OR whop_payment_id = $2) AND status IN ('pending', 'failed') ` +
  `RETURNING ${ORDER_COLUMNS}`;

const MARK_WHOP_FAILED =
  `UPDATE orders SET status = 'failed', whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status = 'pending' AND (whop_payment_id IS NULL OR whop_payment_id = $2) ` +
  `RETURNING ${ORDER_COLUMNS}`;

const CLAIM_CONFIRMATION =
  `UPDATE orders SET confirmation_sent_at = now() ` +
  `WHERE reference = $1 AND whop_payment_id = $2 AND status = 'paid' AND confirmation_sent_at IS NULL ` +
  `RETURNING ${ORDER_COLUMNS}`;

const RELEASE_CONFIRMATION =
  "UPDATE orders SET confirmation_sent_at = NULL WHERE reference = $1 AND whop_payment_id = $2 AND status = 'paid'";

const ABANDON_PENDING =
  "UPDATE orders SET status = 'failed' WHERE reference = $1 AND status = 'pending' AND whop_payment_id IS NULL";

export type WhopSettlement =
  | { outcome: "paid"; order: StoredOrder; sendConfirmation: boolean }
  | { outcome: "failed"; order: StoredOrder }
  | { outcome: "duplicate" }
  | { outcome: "ignored" };

function paymentIdOk(paymentId: string) {
  return /^[A-Za-z0-9_]{4,80}$/.test(paymentId);
}

/**
 * Applies one Whop payment id to one order. A repeat of the same id does not
 * change a paid order again. A failed event never overwrites a paid order.
 */
export async function settleWhopPayment(
  input: { reference: string; paymentId: string; event: "succeeded" | "failed" },
  sql: Sql | null = getSql(),
): Promise<WhopSettlement> {
  const normalized = normalizeOrderReference(input.reference);
  if (!normalized || !paymentIdOk(input.paymentId)) return { outcome: "ignored" };
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);

  const statement = input.event === "succeeded" ? MARK_WHOP_PAID : MARK_WHOP_FAILED;
  const updated = readOrderRow(rowsOf(await sql.query(statement, [normalized, input.paymentId]))[0]);
  if (updated) {
    return input.event === "succeeded"
      ? { outcome: "paid", order: updated, sendConfirmation: updated.confirmationSentAt === null }
      : { outcome: "failed", order: updated };
  }

  const existing = await findOrder(normalized, sql);
  if (!existing || existing.whopPaymentId !== input.paymentId) return { outcome: "ignored" };
  if (input.event === "succeeded" && existing.status === "paid") {
    return existing.confirmationSentAt
      ? { outcome: "duplicate" }
      : { outcome: "paid", order: existing, sendConfirmation: true };
  }
  if (input.event === "failed" && existing.status === "failed") return { outcome: "duplicate" };
  return { outcome: "ignored" };
}

/** One delivery wins the right to send the receipt. A loser sees no row. */
export async function claimOrderConfirmation(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<StoredOrder | null> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentIdOk(paymentId)) return null;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(CLAIM_CONFIRMATION, [normalized, paymentId]);
  return readOrderRow(rowsOf(result)[0]) ?? null;
}

export async function releaseOrderConfirmation(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<void> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentIdOk(paymentId) || !sql) return;
  await sql.query(RELEASE_CONFIRMATION, [normalized, paymentId]);
}

/** A card order whose checkout session never started. No Whop payment id is stored. */
export async function abandonPendingOrder(
  reference: string,
  sql: Sql | null = getSql(),
): Promise<void> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !sql) return;
  await sql.query(ABANDON_PENDING, [normalized]);
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
