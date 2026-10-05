import "server-only";

import { isAuState } from "@/lib/account-data";
import { resolveBankTransfer } from "@/lib/bank-transfer";
import { getSql, type Sql } from "@/lib/db";
import { sendOrderCreatedEmails, type OrderCreatedNotice } from "@/lib/mailer";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import {
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import { lookupPromo } from "@/lib/promo";
import { orderAmountDueCents } from "@/lib/promo-pricing";
import { withTimeout } from "@/lib/with-timeout";

export type BankTransferShippingInput = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type BankTransferOrder = {
  reference: string;
  redirectUrl: string;
  totalCents: number;
};

/** Long enough for a cold Neon compute to wake, short enough to surface a hang. */
const DATABASE_TIMEOUT_MS = 12_000;

const AU_POSTCODE = /^\d{4}$/;

export type CreateBankTransferOrderOptions = {
  /** Injected by tests. Production uses DATABASE_URL via getSql(). */
  sql?: Sql | null;
  /** Injected by tests. Production schedules mail and never awaits the send. */
  deliver?: (notice: OrderCreatedNotice) => Promise<void>;
};

export function bankTransferConfigured() {
  return Boolean(resolveBankTransfer(process.env)) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * The address never affects the amount owed, so it is stored as typed after
 * trimming and length capping. Prices always come from the catalogue.
 * A blank line, city, state, or a postcode that is not four digits is rejected.
 */
export function normalizeShipping(
  shipping: BankTransferShippingInput | null | undefined,
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

function databaseFor(options?: CreateBankTransferOrderOptions) {
  if (options && "sql" in options) return options.sql ?? null;
  return getSql();
}

function redactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/re_[A-Za-z0-9_-]+/gi, "re_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

async function deliverOrderNotice(reference: string, notice: OrderCreatedNotice) {
  const { scheduleEmail } = await import("@/lib/schedule-email");
  scheduleEmail(reference, () => sendOrderCreatedEmails(notice));
}

export async function createBankTransferOrder(
  input: {
    items: CartLineInput[];
    email: string;
    firstName?: string;
    lastName?: string;
    shipping?: BankTransferShippingInput | null;
    promoCode?: string | null;
    ageConfirmed: boolean;
    researchUse: boolean;
  },
  options?: CreateBankTransferOrderOptions,
): Promise<BankTransferOrder> {
  if (!resolveBankTransfer(process.env)) {
    throw new Error("Bank transfer is not configured");
  }
  const sql = databaseFor(options);
  if (!sql) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) {
    throw new Error("A shipping address is required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = orderAmountDueCents(subtotalCents, promo);
  const totalCents = priced.totalCents;
  if (totalCents <= 0) {
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
  const promoCode = promo?.code ?? null;

  const reference = await withTimeout(
    insertOrder(
      {
        currency: "aud",
        subtotalCents,
        totalCents,
        promoCode,
        firstName,
        lastName,
        email,
        items,
        shipping,
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const notice: OrderCreatedNotice = {
    reference,
    firstName,
    lastName,
    email,
    items,
    subtotalCents,
    totalCents,
    promoCode,
    shipping,
  };
  try {
    if (options?.deliver) {
      await options.deliver(notice);
    } else {
      await deliverOrderNotice(reference, notice);
    }
  } catch (error) {
    console.error("[mailer] order email failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: redactError(error),
    });
  }

  return { reference, redirectUrl: `/order/${reference}`, totalCents };
}
