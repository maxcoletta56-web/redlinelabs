import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { lineLabel, resolveCartLines, type CartLineInput, type ResolvedLine } from "@/lib/order";
import {
  audAmount,
  createPayoneerList,
  hostedPaymentPageUrl,
  payoneerListIsPaid,
  readPayoneerList,
  resolvePayoneer,
  type PayoneerList,
} from "@/lib/payoneer";
import { lookupPromo, promoDiscountCents } from "@/lib/promo";
import { absoluteUrl } from "@/lib/seo";
import type { ShippingAddressInput } from "@/lib/shipping";

export type { ShippingAddressInput };

export type PayoneerReceipt = {
  transactionId: string;
  listUrl: string;
  email: string;
  amountCents: number;
  subtotalCents: number;
  currency: "aud";
  lines: ResolvedLine[];
  shipping: ShippingAddressInput | null;
  promoCode: string;
  promoPercentOff: number;
};

const RECEIPT_COOKIE = "rl_payoneer_checkout";

function customerNumber(email: string) {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 20);
}

export function payoneerConfigured() {
  return Boolean(resolvePayoneer(process.env));
}

export async function createPayoneerCheckout(input: {
  items: CartLineInput[];
  email?: string;
  firstName?: string;
  lastName?: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const config = resolvePayoneer(process.env);
  if (!config) {
    throw new Error("Payoneer is not configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const email = input.email?.trim() ?? "";
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const promoOffCents = promoDiscountCents(subtotalCents, promo);
  const amountCents = subtotalCents - promoOffCents;
  const transactionId = `rl_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const firstName = input.firstName?.trim() || "Customer";
  const lastName = input.lastName?.trim() || "Account";

  const list = await createPayoneerList(config, {
    transactionId,
    country: "AU",
    customer: {
      number: customerNumber(email || transactionId),
      email: email || undefined,
      name: { firstName, lastName },
    },
    payment: {
      amount: audAmount(amountCents),
      currency: "AUD",
      reference: lines.map((line) => lineLabel(line)).join(", ").slice(0, 120),
    },
    style: { hostedVersion: "v3" },
    callback: {
      returnUrl: absoluteUrl(`/checkout/success?session_id=${transactionId}`),
      cancelUrl: absoluteUrl("/checkout"),
      notificationUrl: absoluteUrl("/api/checkout/notify"),
    },
  });

  const receipt: PayoneerReceipt = {
    transactionId,
    listUrl: list.listUrl,
    email,
    amountCents,
    subtotalCents,
    currency: "aud",
    lines,
    shipping: input.shipping ?? null,
    promoCode: promo?.code ?? "",
    promoPercentOff: promo?.percentOff ?? 0,
  };
  const jar = await cookies();
  jar.set(RECEIPT_COOKIE, Buffer.from(JSON.stringify(receipt), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });

  return hostedPaymentPageUrl(config.mode, list.listUrl);
}

function readReceipt(value: string | undefined): PayoneerReceipt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PayoneerReceipt;
    if (!parsed?.transactionId || !parsed.listUrl || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadPayoneerReceipt(sessionId?: string | null): Promise<{
  receipt: PayoneerReceipt;
  list: PayoneerList;
  paid: boolean;
} | null> {
  const config = resolvePayoneer(process.env);
  if (!config) return null;
  const jar = await cookies();
  const receipt = readReceipt(jar.get(RECEIPT_COOKIE)?.value);
  if (!receipt) return null;

  const list = await readPayoneerList(config, receipt.listUrl);
  const identifiers = [receipt.transactionId, list.longId, list.transactionId].filter(Boolean);
  if (sessionId && !identifiers.includes(sessionId)) return null;
  return { receipt, list, paid: payoneerListIsPaid(list.statusCode) };
}
