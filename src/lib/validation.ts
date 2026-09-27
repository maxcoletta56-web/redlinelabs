export type CartLineInput = {
  slug: string;
  option?: string | null;
  qty: number;
};

export type CheckoutShipping = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
};

export type CheckoutPaymentMethod = "card" | "bank_transfer";

export type CheckoutBody = {
  email: string;
  firstName?: string;
  lastName?: string;
  ageConfirmed: boolean;
  researchUse: boolean;
  items: CartLineInput[];
  promoCode?: string | null;
  shipping?: CheckoutShipping | null;
  paymentMethod?: CheckoutPaymentMethod;
};

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: Array<{ message: string }> } };

function fail(message: string): ParseResult<never> {
  return { success: false, error: { issues: [{ message }] } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCartLine(value: unknown): ParseResult<CartLineInput> {
  const row = asRecord(value);
  if (!row) return fail("Each cart line must be an object");
  const slug = readString(row.slug);
  if (!slug || slug.length > 80) return fail("Each cart line needs a catalogue slug");
  const qty = Number(row.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return fail("Each line needs a quantity between 1 and 99");
  }
  const option =
    row.option === null || row.option === undefined ? null : readString(row.option);
  if (option && option.length > 80) return fail("Choose a valid option");
  return { success: true, data: { slug, option, qty } };
}

export const cartLineSchema = { safeParse: parseCartLine };

function parseShipping(value: unknown): ParseResult<CheckoutShipping | null> {
  if (value == null) return { success: true, data: null };
  const row = asRecord(value);
  if (!row) return fail("Shipping address is invalid");
  const name = readString(row.name);
  const line1 = readString(row.line1);
  const city = readString(row.city);
  const state = readString(row.state);
  const postal = readString(row.postal_code);
  if (!name && !line1 && !city && !state && !postal) return { success: true, data: null };
  if (!name || !line1 || !city || !state || !postal) return fail("Shipping address is incomplete");
  if ([name, line1, city, state, postal].some((part) => part.length > 120)) {
    return fail("Shipping address is invalid");
  }
  const line2 = readString(row.line2);
  const country = readString(row.country) || "AU";
  return {
    success: true,
    data: {
      name,
      line1,
      line2: line2 || undefined,
      city,
      state,
      postal_code: postal,
      country,
    },
  };
}

export function parseCheckoutBody(value: unknown): ParseResult<CheckoutBody> {
  const row = asRecord(value);
  if (!row) return fail("Invalid checkout payload");
  const email = readString(row.email);
  if (!email || !email.includes("@") || email.length > 200) {
    return fail("A valid email is required");
  }
  if (row.ageConfirmed !== true || row.researchUse !== true) {
    return fail("Age and research-use confirmation are required");
  }
  if (!Array.isArray(row.items) || row.items.length === 0 || row.items.length > 50) {
    return fail("Cart is empty");
  }
  const items: CartLineInput[] = [];
  for (const item of row.items) {
    const parsed = parseCartLine(item);
    if (!parsed.success) return parsed;
    items.push(parsed.data);
  }
  const firstName = readString(row.firstName);
  const lastName = readString(row.lastName);
  const promoCode = row.promoCode == null ? null : readString(row.promoCode);
  if (promoCode && promoCode.length > 40) return fail("That promo code is not valid");
  const shipping = parseShipping(row.shipping);
  if (!shipping.success) return shipping;
  const paymentRaw = readString(row.paymentMethod);
  const paymentMethod =
    paymentRaw === "" ? undefined : paymentRaw === "card" || paymentRaw === "bank_transfer" ? paymentRaw : null;
  if (paymentMethod === null) return fail("Choose card or bank transfer");
  return {
    success: true,
    data: {
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      ageConfirmed: true,
      researchUse: true,
      items,
      promoCode,
      shipping: shipping.data,
      paymentMethod,
    },
  };
}

export const checkoutBodySchema = { safeParse: parseCheckoutBody };

export function parseCheckoutSessionQuery(value: unknown): ParseResult<{ session_id: string }> {
  const row = asRecord(value);
  const sessionId = readString(row?.session_id);
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(sessionId)) {
    return fail("Missing checkout session");
  }
  return { success: true, data: { session_id: sessionId } };
}

export const checkoutSessionQuerySchema = { safeParse: parseCheckoutSessionQuery };

export function parseContactBody(value: unknown): ParseResult<{
  name: string;
  email: string;
  message: string;
  company?: string;
}> {
  const row = asRecord(value);
  if (!row) return fail("Invalid contact payload");
  const name = readString(row.name);
  const email = readString(row.email);
  const message = readString(row.message);
  const company = readString(row.company);
  if (!name || name.length > 120) return fail("Name is required");
  if (!email || !email.includes("@") || email.length > 200) {
    return fail("A valid email is required");
  }
  if (!message || message.length > 5000) return fail("Message is required");
  if (company.length > 0) {
    return { success: true, data: { name, email, message, company } };
  }
  return { success: true, data: { name, email, message } };
}

export const contactBodySchema = { safeParse: parseContactBody };
