export type PaypalMode = "live" | "sandbox";

export type PaypalEnv = Record<string, string | undefined>;

export type ResolvedPaypal = {
  clientId: string;
  clientSecret: string;
  mode: PaypalMode;
};

export type PaypalOrderLine = {
  name: string;
  sku: string;
  qty: number;
  unitAmountCents: number;
};

export type PaypalOrderAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: "AU";
};

export type PaypalOrderInput = {
  transactionId: string;
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
  lines: PaypalOrderLine[];
  shipping: PaypalOrderAddress;
  email?: string;
  firstName?: string;
  lastName?: string;
  returnUrl: string;
  cancelUrl: string;
  brandName: string;
};

export type PaypalOrderView = {
  id: string;
  status: string | null;
  transactionId: string | null;
  amount: string | null;
  currency: string | null;
  captureAmount: string | null;
  captureCurrency: string | null;
  captureStatus: string | null;
};

const ORDER_ID = /^[A-Z0-9]{10,36}$/;

export function shouldRequireLivePaypal(env: PaypalEnv) {
  const required = env.PAYPAL_REQUIRE_LIVE?.toLowerCase();
  if (required === "1" || required === "true") return true;
  return env.VERCEL_ENV === "production";
}

export function resolvePaypal(env: PaypalEnv): ResolvedPaypal | undefined {
  const clientId = env.PAYPAL_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || clientId.length > 200 || clientSecret.length > 200) {
    return undefined;
  }

  const requested = env.PAYPAL_ENV?.trim().toLowerCase();
  const mode: PaypalMode =
    requested === "sandbox" || requested === "live"
      ? requested
      : shouldRequireLivePaypal(env)
        ? "live"
        : "sandbox";

  if (shouldRequireLivePaypal(env) && mode !== "live") return undefined;
  return { clientId, clientSecret, mode };
}

export function paypalApiOrigin(mode: PaypalMode) {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalCheckoutOrigin(mode: PaypalMode) {
  return mode === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
}

export function paypalMoney(cents: number) {
  const amount = Math.round(cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Checkout amount must be greater than zero");
  }
  return (amount / 100).toFixed(2);
}

export function isPaypalOrderId(value: string) {
  return ORDER_ID.test(value);
}

export function isPaypalApprovalUrl(value: string, mode: PaypalMode, orderId: string) {
  if (!isPaypalOrderId(orderId)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (url.origin !== paypalCheckoutOrigin(mode)) return false;
    if (url.pathname !== "/checkoutnow") return false;
    return url.searchParams.get("token") === orderId;
  } catch {
    return false;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function clip(value: string, max: number) {
  let cleaned = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code !== 127) cleaned += char;
  }
  return cleaned.trim().slice(0, max);
}

export function paypalApprovalUrl(value: unknown, mode: PaypalMode, orderId: string) {
  const links = Array.isArray(asRecord(value)?.links) ? (asRecord(value)?.links as unknown[]) : [];
  for (const rel of ["payer-action", "approve"]) {
    for (const link of links) {
      const item = asRecord(link);
      if (item?.rel !== rel || typeof item.href !== "string") continue;
      if (isPaypalApprovalUrl(item.href, mode, orderId)) return item.href;
    }
  }
  throw new Error("PayPal did not return a card checkout");
}

export function buildPaypalOrder(input: PaypalOrderInput) {
  if (input.lines.length === 0) {
    throw new Error("Cart is empty");
  }
  if (
    input.discountCents < 0 ||
    input.subtotalCents - input.discountCents !== input.amountCents
  ) {
    throw new Error("Checkout amount must be greater than zero");
  }

  const items = input.lines.map((line) => {
    const item: Record<string, unknown> = {
      name: clip(line.name, 127),
      quantity: String(line.qty),
      unit_amount: { currency_code: "AUD", value: paypalMoney(line.unitAmountCents) },
      category: "PHYSICAL_GOODS",
    };
    const sku = clip(line.sku, 127);
    if (sku) item.sku = sku;
    return item;
  });

  const breakdown: Record<string, unknown> = {
    item_total: { currency_code: "AUD", value: paypalMoney(input.subtotalCents) },
  };
  if (input.discountCents > 0) {
    breakdown.discount = { currency_code: "AUD", value: paypalMoney(input.discountCents) };
  }

  const givenName = clip(input.firstName || "Customer", 140);
  const surname = clip(input.lastName || "Account", 140);
  const email = input.email?.trim() ?? "";

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: input.transactionId,
        invoice_id: input.transactionId,
        description: clip(
          input.lines.map((line) => line.name).join(", "),
          127,
        ),
        amount: {
          currency_code: "AUD",
          value: paypalMoney(input.amountCents),
          breakdown,
        },
        items,
        shipping: {
          name: { full_name: clip(input.shipping.name, 300) || "Customer" },
          address: {
            address_line_1: clip(input.shipping.line1, 300),
            ...(input.shipping.line2
              ? { address_line_2: clip(input.shipping.line2, 300) }
              : {}),
            admin_area_2: clip(input.shipping.city, 120),
            admin_area_1: clip(input.shipping.state, 300),
            postal_code: clip(input.shipping.postalCode, 60),
            country_code: input.shipping.countryCode,
          },
        },
      },
    ],
    payment_source: {
      paypal: {
        ...(email ? { email_address: email } : {}),
        name: { given_name: givenName, surname },
        experience_context: {
          brand_name: clip(input.brandName, 127) || "Redline Labs",
          // Opens PayPal's card form. The buyer pays by card on PayPal and returns here.
          landing_page: "GUEST_CHECKOUT",
          user_action: "PAY_NOW",
          shipping_preference: "SET_PROVIDED_ADDRESS",
          payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
          locale: "en-AU",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
    },
  };
}

export function parsePaypalOrder(value: unknown): PaypalOrderView {
  const row = asRecord(value);
  const id = typeof row?.id === "string" ? row.id : "";
  if (!isPaypalOrderId(id)) {
    throw new Error("PayPal did not return a card checkout");
  }
  const unit = asRecord(Array.isArray(row?.purchase_units) ? row.purchase_units[0] : null);
  const amount = asRecord(unit?.amount);
  const payments = asRecord(unit?.payments);
  const captures = Array.isArray(payments?.captures) ? payments.captures : [];
  const capture = asRecord(
    captures.find((item) => asRecord(item)?.status === "COMPLETED") ?? captures[0],
  );
  const captureAmount = asRecord(capture?.amount);
  const customId = typeof unit?.custom_id === "string" ? unit.custom_id : null;
  const invoiceId = typeof unit?.invoice_id === "string" ? unit.invoice_id : null;
  return {
    id,
    status: typeof row?.status === "string" ? row.status : null,
    transactionId: customId && invoiceId && customId !== invoiceId ? null : invoiceId || customId,
    amount: typeof amount?.value === "string" ? amount.value : null,
    currency: typeof amount?.currency_code === "string" ? amount.currency_code : null,
    captureAmount: typeof captureAmount?.value === "string" ? captureAmount.value : null,
    captureCurrency:
      typeof captureAmount?.currency_code === "string" ? captureAmount.currency_code : null,
    captureStatus: typeof capture?.status === "string" ? capture.status : null,
  };
}

export function paypalOrderMatches(
  order: PaypalOrderView,
  expected: { orderId: string; transactionId: string; amount: string },
) {
  return (
    order.id === expected.orderId &&
    order.transactionId === expected.transactionId &&
    order.currency === "AUD" &&
    order.amount === expected.amount
  );
}

export function paypalOrderIsPaid(
  order: PaypalOrderView,
  expected: { orderId: string; transactionId: string; amount: string },
) {
  return (
    paypalOrderMatches(order, expected) &&
    order.status === "COMPLETED" &&
    order.captureStatus === "COMPLETED" &&
    order.captureCurrency === "AUD" &&
    order.captureAmount === expected.amount
  );
}

async function paypalAccessToken(config: ResolvedPaypal) {
  const response = await fetch(`${paypalApiOrigin(config.mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error("PayPal could not start checkout");
  }
  const token = asRecord(await response.json())?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("PayPal could not start checkout");
  }
  return token;
}

function paypalHeaders(token: string, requestId: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "PayPal-Request-Id": requestId,
    Prefer: "return=representation",
  };
}

export async function createPaypalOrder(
  config: ResolvedPaypal,
  body: ReturnType<typeof buildPaypalOrder>,
  requestId: string,
) {
  const token = await paypalAccessToken(config);
  const response = await fetch(`${paypalApiOrigin(config.mode)}/v2/checkout/orders`, {
    method: "POST",
    headers: paypalHeaders(token, requestId),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("PayPal could not start checkout");
  }
  const json: unknown = await response.json();
  const order = parsePaypalOrder(json);
  return { id: order.id, approvalUrl: paypalApprovalUrl(json, config.mode, order.id) };
}

export async function confirmPaypalOrder(
  config: ResolvedPaypal,
  orderId: string,
  expected: { transactionId: string; amount: string },
) {
  if (!isPaypalOrderId(orderId)) {
    throw new Error("PayPal could not confirm this payment");
  }
  const token = await paypalAccessToken(config);
  const expectedMatch = { orderId, ...expected };

  const read = async () => {
    const response = await fetch(`${paypalApiOrigin(config.mode)}/v2/checkout/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("PayPal could not confirm this payment");
    }
    return parsePaypalOrder(await response.json());
  };

  let order = await read();
  if (!paypalOrderMatches(order, expectedMatch)) {
    throw new Error("PayPal could not confirm this payment");
  }
  if (order.status === "APPROVED") {
    const response = await fetch(
      `${paypalApiOrigin(config.mode)}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: paypalHeaders(token, `capture_${orderId}`),
      },
    );
    if (response.ok) {
      order = parsePaypalOrder(await response.json());
    } else if (response.status === 422) {
      order = await read();
    } else {
      throw new Error("PayPal could not confirm this payment");
    }
    if (!paypalOrderMatches(order, expectedMatch)) {
      throw new Error("PayPal could not confirm this payment");
    }
  }
  return { order, paid: paypalOrderIsPaid(order, expectedMatch) };
}
