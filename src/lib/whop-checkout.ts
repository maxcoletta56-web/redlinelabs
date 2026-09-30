import "server-only";

import { isAuState } from "@/lib/account-data";
import { getSql, type Sql } from "@/lib/db";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import {
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import { lookupPromo } from "@/lib/promo";
import { cardChargeCents } from "@/lib/promo-pricing";
import { absoluteUrl } from "@/lib/seo";
import { withTimeout } from "@/lib/with-timeout";
import {
  createCheckoutConfiguration,
  resolveWhopConfig,
  type CreatedCheckout,
  type WhopConfig,
  type WhopEnvironment,
  type WhopEnv,
} from "@/lib/whop";

export type WhopShippingInput = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
  returnUrl: string;
  totalCents: number;
};

const DATABASE_TIMEOUT_MS = 12_000;
const AU_POSTCODE = /^\d{4}$/;

const CREATE_WHOP_CHECKOUTS = `CREATE TABLE IF NOT EXISTS whop_checkouts (
  reference TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export type CreateWhopCardCheckoutOptions = {
  sql?: Sql | null;
  fetchImpl?: typeof fetch;
  config?: WhopConfig | null;
};

export function whopCardConfigured(env: WhopEnv = process.env) {
  return Boolean(resolveWhopConfig(env)) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

export function normalizeWhopShipping(
  shipping: WhopShippingInput | null | undefined,
): OrderShippingSnapshot | null {
  const line1 = trimmed(shipping?.line1, 200);
  const city = trimmed(shipping?.city, 120);
  const state = trimmed(shipping?.state, 60);
  const postcode = trimmed(shipping?.postal_code, 20);
  if (!line1 || !city || !isAuState(state) || !AU_POSTCODE.test(postcode)) return null;
  return {
    name: trimmed(shipping?.name, 120),
    line1,
    line2: trimmed(shipping?.line2, 200),
    city,
    state,
    postcode,
    country: trimmed(shipping?.country, 2).toUpperCase() || "AU",
  };
}

export function whopReturnPath(reference: string) {
  return `/checkout/return/${reference}`;
}

function databaseFor(options?: CreateWhopCardCheckoutOptions) {
  if (options && "sql" in options) return options.sql ?? null;
  return getSql();
}

async function rememberCheckout(
  sql: Sql,
  reference: string,
  created: CreatedCheckout,
  environment: WhopEnvironment,
) {
  const { ensureTable } = await import("@/lib/db");
  await ensureTable(sql, "whop_checkouts", CREATE_WHOP_CHECKOUTS);
  await sql.query(
    "INSERT INTO whop_checkouts (reference, session_id, plan_id, environment) VALUES ($1, $2, $3, $4) " +
      "ON CONFLICT (reference) DO UPDATE SET session_id = EXCLUDED.session_id, plan_id = EXCLUDED.plan_id, environment = EXCLUDED.environment",
    [reference, created.sessionId, created.planId, environment],
  );
}

export type StoredWhopCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
};

export async function findWhopCheckout(
  reference: string,
  sql: Sql | null = getSql(),
): Promise<StoredWhopCheckout | null> {
  if (!sql) return null;
  const { ensureTable, rowsOf } = await import("@/lib/db");
  await ensureTable(sql, "whop_checkouts", CREATE_WHOP_CHECKOUTS);
  const result = await sql.query(
    "SELECT reference, session_id, plan_id, environment FROM whop_checkouts WHERE reference = $1",
    [reference],
  );
  const row = rowsOf(result)[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const sessionId = typeof row.session_id === "string" ? row.session_id : "";
  const planId = typeof row.plan_id === "string" ? row.plan_id : "";
  const environment = row.environment === "production" ? "production" : "sandbox";
  if (!sessionId || !planId) return null;
  return { reference, sessionId, planId, environment };
}

/**
 * Prices the cart from the catalogue, stores a pending order, then creates a
 * Whop checkout configuration. The browser never supplies the amount.
 */
export async function createWhopCardCheckout(
  input: {
    items: CartLineInput[];
    email: string;
    firstName?: string;
    lastName?: string;
    shipping?: WhopShippingInput | null;
    promoCode?: string | null;
    ageConfirmed: boolean;
    researchUse: boolean;
  },
  options?: CreateWhopCardCheckoutOptions,
): Promise<WhopCardCheckout> {
  const config = options && "config" in options ? options.config : resolveWhopConfig();
  if (!config) {
    throw new Error("Whop checkout is not configured");
  }
  const sql = databaseFor(options);
  if (!sql) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeWhopShipping(input.shipping);
  if (!shipping) {
    throw new Error("A shipping address is required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const charge = cardChargeCents(subtotalCents, promo);
  if (charge.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const items: OrderItemSnapshot[] = lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));
  const firstName = trimmed(input.firstName, 120) || "Customer";
  const lastName = trimmed(input.lastName, 120) || "Account";
  const email = trimmed(input.email, 200).toLowerCase();

  const reference = await withTimeout(
    insertOrder(
      {
        currency: "aud",
        subtotalCents,
        totalCents: charge.totalCents,
        promoCode: promo?.code ?? null,
        firstName,
        lastName,
        email,
        items,
        shipping,
        status: "pending",
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const returnUrl = absoluteUrl(whopReturnPath(reference));
  const created = await createCheckoutConfiguration(
    config,
    {
      orderId: reference,
      amountCents: charge.totalCents,
      returnUrl,
      title: `Order ${reference}`,
    },
    options?.fetchImpl,
  );
  await rememberCheckout(sql, reference, created, config.environment);

  return {
    reference,
    sessionId: created.sessionId,
    planId: created.planId,
    environment: config.environment,
    returnUrl,
    totalCents: charge.totalCents,
  };
}
