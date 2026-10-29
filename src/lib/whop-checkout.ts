import "server-only";

import { createCheckoutOrder, type CheckoutOrderInput } from "@/lib/bank-transfer-checkout";
import type { Sql } from "@/lib/db";
import type { OrderCreatedNotice } from "@/lib/mailer";
import { attachWhopCheckout, ordersConfigured } from "@/lib/orders";
import { absoluteUrl } from "@/lib/seo";
import {
  readWhopCheckoutConfiguration,
  resolveWhop,
  WHOP_API_VERSION_DATE,
  whopCheckoutConfigurationBody,
  type ResolvedWhop,
} from "@/lib/whop";
import type { WhopEmbedSession } from "@/lib/whop-session";

export function whopConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(resolveWhop(env)) && ordersConfigured();
}

export type OpenWhopCheckoutOptions = {
  sql?: Sql | null;
  deliver?: (notice: OrderCreatedNotice) => Promise<void>;
  env?: NodeJS.ProcessEnv;
  siteUrl?: (path: string) => string;
  createConfiguration?: (
    config: ResolvedWhop,
    body: ReturnType<typeof whopCheckoutConfigurationBody>,
    idempotencyKey: string,
  ) => Promise<unknown>;
};

async function postCheckoutConfiguration(
  config: ResolvedWhop,
  body: ReturnType<typeof whopCheckoutConfigurationBody>,
  idempotencyKey: string,
) {
  const response = await fetch(`${config.baseUrl}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": WHOP_API_VERSION_DATE,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error("Whop did not open card checkout");
  }
  return response.json() as Promise<unknown>;
}

/**
 * Saves a pending order at the catalogue total, then opens a Whop checkout
 * configuration priced in AUD. The browser never supplies the amount.
 */
export async function createWhopCheckout(
  input: CheckoutOrderInput,
  options: OpenWhopCheckoutOptions = {},
): Promise<WhopEmbedSession> {
  const env = options.env ?? process.env;
  const config = resolveWhop(env);
  if (!config) throw new Error("Card checkout is not configured");

  const order = await createCheckoutOrder(input, {
    sql: options.sql,
    deliver: options.deliver,
    paymentMethod: "whop",
    skipBankConfiguration: true,
  });
  const returnUrl = (options.siteUrl ?? absoluteUrl)(`/order/${order.reference}?whop=return`);
  const body = whopCheckoutConfigurationBody({
    reference: order.reference,
    totalCents: order.totalCents,
    redirectUrl: returnUrl,
    accountId: config.accountId,
  });
  const create = options.createConfiguration ?? postCheckoutConfiguration;
  let remote: unknown;
  try {
    remote = await create(config, body, `whop-order-${order.reference}`);
  } catch (error) {
    console.error("[whop] checkout configuration failed", {
      reference: order.reference,
      mode: config.mode,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    throw new Error("Card checkout did not open. Nothing has been charged.");
  }
  const configuration = readWhopCheckoutConfiguration(remote);
  if (!configuration) {
    throw new Error("Card checkout did not open. Nothing has been charged.");
  }
  const sql = options.sql === undefined ? undefined : options.sql;
  const attached = await attachWhopCheckout(
    order.reference,
    configuration.id,
    configuration.planId,
    sql,
  );
  if (!attached) {
    throw new Error("Card checkout did not open. Nothing has been charged.");
  }
  return {
    planId: configuration.planId,
    environment: config.mode,
    returnUrl,
    email: order.email,
    reference: order.reference,
  };
}
