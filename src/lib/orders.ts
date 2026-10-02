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
  whopCheckoutId: string | null;
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
  whopCheckoutId?: string | null;
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
  whop_checkout_id TEXT,
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
  "whop_checkout_id",
  "whop_payment_id",
].join(", ");

const INSERT_ORDER =
  "INSERT INTO orders (reference, status, currency, subtotal_cents, total_cents, promo_code, first_name, last_name, email, items, shipping, whop_checkout_id) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12) " +
  "ON CONFLICT (reference) DO NOTHING RETURNING reference";

const ATTACH_WHOP_CHECKOUT =
  "UPDATE orders SET whop_checkout_id = $2 WHERE reference = $1 AND whop_checkout_id IS NULL";

const MARK_WHOP_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()), whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status <> 'paid' RETURNING ${ORDER_COLUMNS}`;

const MARK_WHOP_FAILED =
  `UPDATE orders SET status = 'failed', whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status = 'pending' RETURNING ${ORDER_COLUMNS}`;

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
    whopCheckoutId: readText(record.whop_checkout_id) || null,
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
      order.whopCheckoutId ?? null,
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

export type PaymentReceivedNotice = {
  reference: string;
  firstName: string;
  email: string;
  totalCents: number;
};

/** Test and caller overrides. Production uses the database and the mailer. */
export type MarkPaidEmailHooks = {
  findOrder?: (reference: string) => Promise<StoredOrder | null>;
  markOrderPaid?: (reference: string) => Promise<StoredOrder | null>;
  scheduleEmail?: (reference: string, task: () => Promise<void>) => void;
  sendPaymentReceivedEmail?: (notice: PaymentReceivedNotice) => Promise<void>;
};

type PaymentEmailDeps = {
  scheduleEmail: (reference: string, task: () => Promise<void>) => void;
  sendPaymentReceivedEmail: (notice: PaymentReceivedNotice) => Promise<void>;
};

/**
 * Loaded on the paid path only. A static import would pull `server-only`
 * into the order unit tests, which run outside Next's server graph.
 */
let paymentEmailDeps: Promise<PaymentEmailDeps> | undefined;

function loadPaymentEmailDeps(): Promise<PaymentEmailDeps> {
  paymentEmailDeps ??= Promise.all([import("./schedule-email.ts"), import("./mailer.ts")])
    .then(([schedule, mailer]) => ({
      scheduleEmail: schedule.scheduleEmail,
      sendPaymentReceivedEmail: mailer.sendPaymentReceivedEmail,
    }))
    .catch((error: unknown) => {
      paymentEmailDeps = undefined;
      throw error;
    });
  return paymentEmailDeps;
}

function paymentReceivedNotice(order: StoredOrder): PaymentReceivedNotice {
  return {
    reference: order.reference,
    firstName: order.firstName,
    email: order.email,
    totalCents: order.totalCents,
  };
}

/**
 * Lookup, then mark paid, then schedule the receipt when this transition is
 * the one that leaves `awaiting_payment`. A lookup failure is logged and does
 * not block the update. The email task is not awaited: `scheduleEmail`
 * already swallows mail errors and runs after the response.
 */
export async function markOrderPaidWithPaymentEmail(
  reference: string,
  hooks: MarkPaidEmailHooks = {},
): Promise<StoredOrder | null> {
  const lookup = hooks.findOrder ?? findOrder;
  const markPaid = hooks.markOrderPaid ?? markOrderPaid;
  const normalized = normalizeOrderReference(reference) ?? reference;

  const existing = await lookup(reference).catch((error: unknown) => {
    console.error("[admin] order lookup before paid email failed", {
      reference: normalized,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  const order = await markPaid(reference);
  if (!order) return null;

  if (existing?.status !== "paid") {
    try {
      const deps: PaymentEmailDeps =
        hooks.scheduleEmail && hooks.sendPaymentReceivedEmail
          ? {
              scheduleEmail: hooks.scheduleEmail,
              sendPaymentReceivedEmail: hooks.sendPaymentReceivedEmail,
            }
          : await loadPaymentEmailDeps();
      const schedule = hooks.scheduleEmail ?? deps.scheduleEmail;
      const send = hooks.sendPaymentReceivedEmail ?? deps.sendPaymentReceivedEmail;
      schedule(order.reference, () => send(paymentReceivedNotice(order)));
    } catch (error) {
      // Mail setup must not turn a committed payment into a failed update.
      console.error("[mailer] order email failed", {
        reference: order.reference,
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return order;
}

export async function attachWhopCheckout(
  reference: string,
  checkoutId: string,
  sql: Sql | null = getSql(),
): Promise<void> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !checkoutId) return;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  await sql.query(ATTACH_WHOP_CHECKOUT, [normalized, checkoutId]);
}

/**
 * Moves a card order to paid once. A repeat of the same settlement matches no
 * rows because the status is already paid, so the caller does not email again.
 */
export async function markWhopOrderPaid(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<{ order: StoredOrder | null; applied: boolean }> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentId) return { order: null, applied: false };
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(MARK_WHOP_PAID, [normalized, paymentId]);
  const updated = readOrderRow(rowsOf(result)[0]);
  if (updated) return { order: updated, applied: true };
  return { order: await findOrder(normalized, sql), applied: false };
}

/** A failed card attempt only leaves pending. Paid orders stay paid. */
export async function markWhopOrderFailed(
  reference: string,
  paymentId: string,
  sql: Sql | null = getSql(),
): Promise<{ order: StoredOrder | null; applied: boolean }> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized || !paymentId) return { order: null, applied: false };
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(MARK_WHOP_FAILED, [normalized, paymentId]);
  const updated = readOrderRow(rowsOf(result)[0]);
  if (updated) return { order: updated, applied: true };
  return { order: await findOrder(normalized, sql), applied: false };
}
