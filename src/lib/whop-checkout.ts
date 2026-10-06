import "server-only";

import { headers } from "next/headers";
import { normalizeShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { getSql } from "@/lib/db";
import { lineLabel } from "@/lib/order";
import type { CartLineInput } from "@/lib/order";
import { insertOrder, ordersConfigured } from "@/lib/orders";
import { absoluteUrl } from "@/lib/seo";
import { withTimeout } from "@/lib/with-timeout";
import {
  buildCheckoutConfigurationBody,
  postCheckoutConfiguration,
  priceCardOrder,
  resolveWhop,
  type WhopEnvironment,
} from "@/lib/whop";

const DATABASE_TIMEOUT_MS = 12_000;
const WHOP_TIMEOUT_MS = 12_000;

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
  returnUrl: string;
  totalCents: number;
};

export function whopCardConfigured() {
  return Boolean(resolveWhop(process.env)) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/** Return URL for 3D Secure and other off-site next actions. Only our own origins. */
export function checkoutReturnOrigin(headerStore: { get(name: string): string | null }) {
  const site = new URL(absoluteUrl("/"));
  const originHeader = headerStore.get("origin");
  if (originHeader) {
    const allowed = allowOrigin(originHeader, site);
    if (allowed) return allowed;
  }
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (host) {
    const proto = headerStore.get("x-forwarded-proto") ?? site.protocol.replace(":", "");
    const allowed = allowOrigin(`${proto}://${host}`, site);
    if (allowed) return allowed;
  }
  return site.origin;
}

function allowOrigin(candidate: string, site: URL) {
  try {
    const url = new URL(candidate);
    if (url.origin === site.origin) return url.origin;
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) return url.origin;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
    return null;
  } catch {
    return null;
  }
}

export async function createWhopCardCheckout(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: BankTransferShippingInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}): Promise<WhopCardCheckout> {
  const config = resolveWhop(process.env);
  if (!config) throw new Error("Card checkout is not configured");
  const sql = getSql();
  if (!sql) throw new Error("Orders are unavailable until the database is configured");
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) throw new Error("A shipping address is required");

  const priced = priceCardOrder(input.items, input.promoCode);
  const reference = await withTimeout(
    insertOrder(
      {
        currency: "aud",
        subtotalCents: priced.catalogCents,
        totalCents: priced.totalCents,
        promoCode: priced.promoCode,
        firstName: trimmed(input.firstName, 120) || "Customer",
        lastName: trimmed(input.lastName, 120) || "Account",
        email: trimmed(input.email, 200).toLowerCase(),
        items: priced.lines.map((line) => ({
          slug: line.slug,
          name: lineLabel(line),
          option: line.option,
          variantLabel: line.variantLabel,
          sku: line.sku,
          qty: line.qty,
          unitAmountCents: line.unitAmountCents,
        })),
        shipping,
        status: "pending",
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const headerStore = await headers();
  const returnUrl = `${checkoutReturnOrigin(headerStore)}/checkout/return/${reference}`;
  const session = await withTimeout(
    postCheckoutConfiguration(
      config,
      buildCheckoutConfigurationBody({
        companyId: config.companyId,
        orderId: reference,
        totalCents: priced.totalCents,
        returnUrl,
        title: priced.promoCode ? `Order ${reference} (${priced.promoCode})` : `Order ${reference}`,
      }),
    ),
    WHOP_TIMEOUT_MS,
    "Whop",
  );

  return {
    reference,
    sessionId: session.sessionId,
    planId: session.planId,
    environment: config.environment,
    returnUrl,
    totalCents: priced.totalCents,
  };
}
