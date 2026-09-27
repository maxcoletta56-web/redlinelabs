import "server-only";

import { resolveBankTransfer } from "@/lib/bank-transfer";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import {
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import { lookupPromo, promoDiscountCents } from "@/lib/promo";
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

export function bankTransferConfigured() {
  return Boolean(resolveBankTransfer(process.env)) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * The address never affects the amount owed, so it is stored as typed after
 * trimming and length capping. Prices always come from the catalogue.
 */
function normalizeShipping(
  shipping: BankTransferShippingInput | null | undefined,
): OrderShippingSnapshot | null {
  const line1 = trimmed(shipping?.line1, 200);
  if (!line1) return null;
  return {
    name: trimmed(shipping?.name, 120),
    line1,
    line2: trimmed(shipping?.line2, 200),
    city: trimmed(shipping?.city, 120),
    state: trimmed(shipping?.state, 60),
    postcode: trimmed(shipping?.postal_code, 20),
    country: trimmed(shipping?.country, 2).toUpperCase() || "AU",
  };
}

export async function createBankTransferOrder(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: BankTransferShippingInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}): Promise<BankTransferOrder> {
  if (!resolveBankTransfer(process.env)) {
    throw new Error("Bank transfer is not configured");
  }
  if (!ordersConfigured()) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const totalCents = subtotalCents - promoDiscountCents(subtotalCents, promo);
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

  const reference = await withTimeout(
    insertOrder({
      currency: "aud",
      subtotalCents,
      totalCents,
      promoCode: promo?.code ?? null,
      firstName: trimmed(input.firstName, 120) || "Customer",
      lastName: trimmed(input.lastName, 120) || "Account",
      email: trimmed(input.email, 200).toLowerCase(),
      items,
      shipping: normalizeShipping(input.shipping),
    }),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  // TODO(payments): this repo has no transactional email sender. The contact
  // route only hands the browser a mailto: link, so there is nothing to send
  // the PayID instructions with. Once a sender is added, email the customer
  // the same instructions that /order/[reference] renders.

  return { reference, redirectUrl: `/order/${reference}`, totalCents };
}
