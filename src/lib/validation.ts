export type CartLineInput = {
  slug: string;
  option?: string | null;
  qty: number;
};

export type CheckoutBody = {
  email: string;
  firstName?: string;
  lastName?: string;
  ageConfirmed: boolean;
  researchUse: boolean;
  items: CartLineInput[];
  promoCode?: string | null;
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
