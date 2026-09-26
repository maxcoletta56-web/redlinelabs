import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { ResolvedLine } from "@/lib/order";
import {
  type NewOrder,
  type OrderShipping,
  type OrderStore,
  type PaymentMethod,
  type PaymentStatus,
  type StoredOrder,
} from "@/lib/orders";

type Sql = NeonQueryFunction<false, false>;

type OrderRow = {
  id: string;
  status: PaymentStatus;
  email: string;
  first_name: string;
  last_name: string;
  currency: "aud";
  subtotal_cents: number;
  volume_discount_cents: number;
  promo_code: string;
  promo_discount_cents: number;
  total_cents: number;
  lines_json: string;
  shipping_json: string | null;
  payment_method: PaymentMethod;
  whop_checkout_id: string | null;
  whop_payment_id: string | null;
  confirmation_sent_at: Date | string | null;
  created_at: Date | string;
};

let schema: Promise<void> | null = null;

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || "";
}

export function ordersConfigured() {
  return Boolean(databaseUrl());
}

function sqlClient() {
  const url = databaseUrl();
  if (!url) throw new Error("Order storage is not configured");
  return neon(url);
}

async function ensureSchema(sql: Sql) {
  schema ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS shop_orders (
      id text PRIMARY KEY,
      status text NOT NULL,
      email text NOT NULL,
      first_name text NOT NULL DEFAULT '',
      last_name text NOT NULL DEFAULT '',
      currency text NOT NULL,
      subtotal_cents integer NOT NULL,
      volume_discount_cents integer NOT NULL,
      promo_code text NOT NULL DEFAULT '',
      promo_discount_cents integer NOT NULL,
      total_cents integer NOT NULL,
      lines_json text NOT NULL,
      shipping_json text,
      payment_method text NOT NULL,
      whop_checkout_id text,
      whop_payment_id text,
      confirmation_sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS shop_orders_whop_payment_idx
      ON shop_orders (whop_payment_id)
      WHERE whop_payment_id IS NOT NULL`;
  })().catch((error: unknown) => {
    schema = null;
    throw error;
  });
  await schema;
}

function asIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fromRow(row: OrderRow): StoredOrder {
  return {
    id: row.id,
    status: row.status,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    currency: "aud",
    subtotalCents: row.subtotal_cents,
    volumeDiscountCents: row.volume_discount_cents,
    promoCode: row.promo_code,
    promoDiscountCents: row.promo_discount_cents,
    totalCents: row.total_cents,
    lines: JSON.parse(row.lines_json) as ResolvedLine[],
    shipping: row.shipping_json ? (JSON.parse(row.shipping_json) as OrderShipping) : null,
    paymentMethod: row.payment_method,
    whopCheckoutId: row.whop_checkout_id,
    whopPaymentId: row.whop_payment_id,
    confirmationSentAt: asIso(row.confirmation_sent_at),
    createdAt: asIso(row.created_at) ?? new Date(0).toISOString(),
  };
}

export function createNeonOrderStore(): OrderStore {
  const sql = sqlClient();

  return {
    async insert(order: NewOrder) {
      await ensureSchema(sql);
      const rows = await sql`
        INSERT INTO shop_orders (
          id, status, email, first_name, last_name, currency,
          subtotal_cents, volume_discount_cents, promo_code, promo_discount_cents,
          total_cents, lines_json, shipping_json, payment_method
        ) VALUES (
          ${order.id},
          'pending',
          ${order.email},
          ${order.firstName},
          ${order.lastName},
          'aud',
          ${order.subtotalCents},
          ${order.volumeDiscountCents},
          ${order.promoCode},
          ${order.promoDiscountCents},
          ${order.totalCents},
          ${JSON.stringify(order.lines)},
          ${order.shipping ? JSON.stringify(order.shipping) : null},
          ${order.paymentMethod}
        )
        RETURNING *
      `;
      return fromRow(rows[0] as OrderRow);
    },
    async get(id) {
      await ensureSchema(sql);
      const rows = await sql`SELECT * FROM shop_orders WHERE id = ${id} LIMIT 1`;
      const row = rows[0] as OrderRow | undefined;
      return row ? fromRow(row) : null;
    },
    async attachCheckout(id, checkoutId) {
      await ensureSchema(sql);
      await sql`UPDATE shop_orders
        SET whop_checkout_id = ${checkoutId}, updated_at = now()
        WHERE id = ${id}`;
    },
    async getByCheckout(checkoutId) {
      await ensureSchema(sql);
      const rows = await sql`SELECT * FROM shop_orders WHERE whop_checkout_id = ${checkoutId} LIMIT 1`;
      const row = rows[0] as OrderRow | undefined;
      return row ? fromRow(row) : null;
    },
    async markPaid(id, paymentId) {
      await ensureSchema(sql);
      const rows = await sql`UPDATE shop_orders
        SET status = 'paid', whop_payment_id = ${paymentId}, updated_at = now()
        WHERE id = ${id} AND status <> 'paid'
        RETURNING *`;
      const row = rows[0] as OrderRow | undefined;
      if (row) return fromRow(row);
      const current = await sql`SELECT * FROM shop_orders WHERE id = ${id} LIMIT 1`;
      const existing = current[0] as OrderRow | undefined;
      return existing ? fromRow(existing) : null;
    },
    async markFailed(id, paymentId) {
      await ensureSchema(sql);
      const loaded = await sql`SELECT * FROM shop_orders WHERE id = ${id} LIMIT 1`;
      const current = loaded[0] ? fromRow(loaded[0] as OrderRow) : null;
      if (!current || current.status === "paid") return current;
      if (current.status === "failed" && current.whopPaymentId === paymentId) return current;
      const rows = await sql`UPDATE shop_orders
        SET status = 'failed', whop_payment_id = ${paymentId}, updated_at = now()
        WHERE id = ${id} AND status = 'pending'
        RETURNING *`;
      const row = rows[0] as OrderRow | undefined;
      return row ? fromRow(row) : current;
    },
    async claimConfirmation(id, paymentId) {
      await ensureSchema(sql);
      const rows = await sql`UPDATE shop_orders
        SET confirmation_sent_at = now(), updated_at = now()
        WHERE id = ${id}
          AND whop_payment_id = ${paymentId}
          AND confirmation_sent_at IS NULL
        RETURNING id`;
      return rows.length > 0;
    },
    async releaseConfirmation(id, paymentId) {
      await ensureSchema(sql);
      await sql`UPDATE shop_orders
        SET confirmation_sent_at = NULL, updated_at = now()
        WHERE id = ${id} AND whop_payment_id = ${paymentId}`;
    },
  };
}
