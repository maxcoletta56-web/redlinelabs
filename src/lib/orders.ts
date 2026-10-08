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
  clubEmail: string | null;
  clubPointsRedeemed: number;
  volumeDiscountCents: number;
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
  clubEmail?: string | null;
  clubPointsRedeemed?: number;
  /** Card checkout inserts `pending`. Bank transfer leaves this unset. */
  status?: "awaiting_payment" | "pending";
  volumeDiscountCents?: number;
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
  club_email TEXT,
  club_points_redeemed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  volume_discount_cents INTEGER NOT NULL DEFAULT 0,
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
  "club_email",
  "club_points_redeemed",
  "volume_discount_cents",
  "whop_payment_id",
  `to_char(created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
  `to_char(paid_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS paid_at`,
].join(", ");

const INSERT_ORDER =
  "INSERT INTO orders (reference, status, currency, subtotal_cents, total_cents, promo_code, first_name, last_name, email, items, shipping, club_email, club_points_redeemed, volume_discount_cents) " +
  "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14) " +
  "ON CONFLICT (reference) DO NOTHING RETURNING reference";

const SELECT_ORDER = `SELECT ${ORDER_COLUMNS} FROM orders WHERE reference = $1`;

const LIST_ORDERS = `SELECT ${ORDER_COLUMNS} FROM orders ORDER BY orders.created_at DESC LIMIT $1`;

const MARK_ORDER_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE reference = $1 ` +
  `RETURNING ${ORDER_COLUMNS}`;

/**
 * One Whop payment id can move an order to paid exactly once. A later success
 * for a different payment id is accepted only when the order is still unpaid
 * (including a previous card failure). A paid row is never updated again.
 */
const MARK_WHOP_PAID =
  `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, now()), whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status <> 'paid' AND (` +
  `whop_payment_id IS NULL OR whop_payment_id = $2 OR status = 'failed') ` +
  `RETURNING ${ORDER_COLUMNS}`;

/** A failed card attempt must not overwrite an order that already paid. */
const MARK_WHOP_FAILED =
  `UPDATE orders SET status = 'failed', whop_payment_id = $2 ` +
  `WHERE reference = $1 AND status IN ('pending', 'awaiting_payment') ` +
  `AND (whop_payment_id IS NULL OR whop_payment_id = $2) ` +
  `RETURNING ${ORDER_COLUMNS}`;

const MARK_PENDING_FAILED =
  `UPDATE orders SET status = 'failed' WHERE reference = $1 AND status = 'pending' ` +
  `AND whop_payment_id IS NULL RETURNING ${ORDER_COLUMNS}`;

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
    clubEmail: readText(record.club_email) || null,
    clubPointsRedeemed: readInt(record.club_points_redeemed),
    volumeDiscountCents: readInt(record.volume_discount_cents),
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
      order.status === "pending" ? "pending" : "awaiting_payment",
      order.currency,
      order.subtotalCents,
      order.totalCents,
      order.promoCode,
      order.firstName,
      order.lastName,
      order.email,
      JSON.stringify(order.items),
      order.shipping ? JSON.stringify(order.shipping) : null,
      order.clubEmail ?? null,
      Math.max(0, Math.floor(order.clubPointsRedeemed ?? 0)),
      Math.max(0, Math.floor(order.volumeDiscountCents ?? 0)),
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
  awardClubPoints?: (order: StoredOrder) => Promise<unknown>;
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

/**
 * Points land when the money does, on the amount actually paid, at the tier
 * the member held before this order. Idempotent inside `awardOrderPoints`.
 */
async function awardClubPointsForOrder(order: StoredOrder) {
  const { awardOrderPoints } = await import("./club-db.ts");
  return awardOrderPoints({
    email: order.email,
    orderReference: order.reference,
    paidCents: order.totalCents,
  });
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
 * Points and the payment confirmation email. Mail and club failures are
 * logged and do not undo the paid row. The email task is not awaited.
 */
async function deliverPaidSideEffects(order: StoredOrder, hooks: MarkPaidEmailHooks = {}) {
  try {
    const award = hooks.awardClubPoints ?? awardClubPointsForOrder;
    await award(order);
  } catch (error) {
    console.error("[club] award on paid failed", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }

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
    console.error("[mailer] order email failed", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

/**
 * Lookup, then mark paid, then schedule the receipt when this transition is
 * the one that leaves an unpaid status. A lookup failure is logged and does
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
    await deliverPaidSideEffects(order, hooks);
  }

  return order;
}

export type WhopPaymentOutcome = "succeeded" | "failed";

export type WhopPaymentResult = {
  outcome: "paid" | "failed" | "already_done" | "ignored";
  reference: string | null;
  reason?: string;
};

const WHOP_PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;

/**
 * The signed webhook's gross amount, in major units, must match the cents
 * stored on the order. A missing amount is allowed: some Whop payloads only
 * echo metadata. `amount_after_fees` is net of Whop's fee and is not compared.
 */
export function whopChargeMatches(
  order: { totalCents: number; currency: string },
  payment: { currency?: string | null; total?: number | null },
) {
  if (payment.currency && payment.currency.toLowerCase() !== order.currency.toLowerCase()) {
    return false;
  }
  if (payment.total == null) return true;
  if (!Number.isFinite(payment.total)) return false;
  return Math.round(payment.total * 100) === order.totalCents;
}

/**
 * Applies one Whop payment id. Repeating the same id does not send another
 * confirmation email. A success after a failed attempt with a new payment id
 * can still mark the order paid.
 */
export async function applyWhopPayment(
  input: {
    orderId: string;
    paymentId: string;
    outcome: WhopPaymentOutcome;
    currency?: string | null;
    total?: number | null;
  },
  sql: Sql | null = getSql(),
  hooks: MarkPaidEmailHooks = {},
): Promise<WhopPaymentResult> {
  const reference = normalizeOrderReference(input.orderId);
  const paymentId = input.paymentId.trim();
  if (!reference || !WHOP_PAYMENT_ID.test(paymentId)) {
    return { outcome: "ignored", reference, reason: "unusable_ids" };
  }
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);

  const existing = await findOrder(reference, sql);
  if (!existing) return { outcome: "ignored", reference, reason: "unknown_order" };

  if (input.outcome === "succeeded") {
    if (existing.status === "paid") {
      if (existing.whopPaymentId && existing.whopPaymentId !== paymentId) {
        console.error("[whop] additional payment for an order that is already paid", {
          reference,
          paymentId,
        });
      }
      return { outcome: "already_done", reference };
    }
    if (!whopChargeMatches(existing, { currency: input.currency, total: input.total })) {
      console.error("[whop] payment amount did not match the stored order", {
        reference,
        paymentId,
        currency: input.currency ?? null,
      });
      return { outcome: "ignored", reference, reason: "amount_mismatch" };
    }
    const result = await sql.query(MARK_WHOP_PAID, [reference, paymentId]);
    const order = readOrderRow(rowsOf(result)[0]);
    if (!order) return { outcome: "already_done", reference };
    await deliverPaidSideEffects(order, hooks);
    return { outcome: "paid", reference };
  }

  if (existing.status === "paid") {
    return { outcome: "already_done", reference };
  }
  if (existing.status === "failed" && existing.whopPaymentId === paymentId) {
    return { outcome: "already_done", reference };
  }
  const result = await sql.query(MARK_WHOP_FAILED, [reference, paymentId]);
  const order = readOrderRow(rowsOf(result)[0]);
  if (!order) return { outcome: "already_done", reference };
  return { outcome: "failed", reference };
}

/** Used when Whop never issued a checkout configuration for a pending order. */
export async function markPendingOrderFailed(
  reference: string,
  sql: Sql | null = getSql(),
): Promise<StoredOrder | null> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) return null;
  if (!sql) throw new OrdersUnavailableError();
  await ensureOrdersTable(sql);
  const result = await sql.query(MARK_PENDING_FAILED, [normalized]);
  return readOrderRow(rowsOf(result)[0]) ?? null;
}
