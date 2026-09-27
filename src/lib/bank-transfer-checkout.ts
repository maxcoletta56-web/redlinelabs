import "server-only";

import { resolveBankTransfer } from "@/lib/bank-transfer";
import { catalogueOrderDraft, type CatalogueShippingInput } from "@/lib/catalogue-order";
import type { CartLineInput } from "@/lib/order";
import { insertOrder, ordersConfigured } from "@/lib/orders";
import { withTimeout } from "@/lib/with-timeout";

export type BankTransferShippingInput = CatalogueShippingInput;

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

  const draft = catalogueOrderDraft(input);
  const reference = await withTimeout(
    insertOrder(draft),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  // TODO(payments): this repo has no transactional email sender. The contact
  // route only hands the browser a mailto: link, so there is nothing to send
  // the PayID instructions with. Once a sender is added, email the customer
  // the same instructions that /order/[reference] renders.

  return { reference, redirectUrl: `/order/${reference}`, totalCents: draft.totalCents };
}
