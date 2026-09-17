export const AU_STATES = [
  "NSW",
  "VIC",
  "QLD",
  "WA",
  "SA",
  "TAS",
  "ACT",
  "NT",
] as const;

export type AuState = (typeof AU_STATES)[number];

export type SavedAddress = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  state: AuState;
  postcode: string;
  country: "AU";
  phone: string;
  isDefault: boolean;
};

export type StockAlert = {
  slug: string;
  name: string;
  sku: string;
  createdAt: string;
};

export type OrderLine = {
  slug: string;
  name: string;
  option: string | null;
  sku: string;
  qty: number;
  unitAmountCents: number;
};

export type OrderStatus = "processing" | "dispatched" | "delivered";

export type OrderRecord = {
  id: string;
  stripeSessionId: string | null;
  createdAt: string;
  email: string;
  status: OrderStatus;
  items: OrderLine[];
  subtotalCents: number;
  storeCreditCents: number;
  totalCents: number;
  currency: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shipping: {
    label: string;
    firstName: string;
    lastName: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone: string;
  } | null;
};

export type CreditEntry = {
  id: string;
  at: string;
  amountCents: number;
  note: string;
  orderId?: string;
};

export type AccountUser = {
  email: string;
  passwordHash: string;
  salt: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  storeCreditCents: number;
  creditLedger: CreditEntry[];
  addresses: SavedAddress[];
  stockAlerts: StockAlert[];
  orders: OrderRecord[];
};

export type PublicAccount = Omit<AccountUser, "passwordHash" | "salt">;

export type AddressInput = {
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  phone?: string;
  isDefault?: boolean;
};

export type SignupInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTCODE_PATTERN = /^\d{4}$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAuState(value: string): value is AuState {
  return (AU_STATES as readonly string[]).includes(value);
}

export function publicAccount(user: AccountUser): PublicAccount {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    storeCreditCents: user.storeCreditCents,
    creditLedger: user.creditLedger,
    addresses: user.addresses,
    stockAlerts: user.stockAlerts,
    orders: user.orders,
  };
}

export function defaultAddress(user: Pick<AccountUser, "addresses">) {
  return user.addresses.find((address) => address.isDefault) ?? user.addresses[0] ?? null;
}

export function validateSignup(input: SignupInput) {
  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const password = input.password;
  if (!firstName) return "First name is required";
  if (!lastName) return "Last name is required";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address";
  if (password.length < 8) return "Password must be at least 8 characters";
  return null;
}

export function validateAddress(input: AddressInput) {
  if (!input.firstName.trim()) return "First name is required";
  if (!input.lastName.trim()) return "Last name is required";
  if (!input.line1.trim()) return "Address line 1 is required";
  if (!input.city.trim()) return "Suburb or city is required";
  if (!isAuState(input.state)) return "Select an Australian state or territory";
  if (!POSTCODE_PATTERN.test(input.postcode.trim())) {
    return "Enter a 4-digit Australian postcode";
  }
  return null;
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function newId() {
  return crypto.randomUUID();
}

export function randomSalt() {
  return bufferToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(digest);
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyPassword(user: AccountUser, password: string) {
  const hash = await hashPassword(password, user.salt);
  return safeEqual(hash, user.passwordHash);
}

export async function createUser(input: SignupInput, at = new Date().toISOString()): Promise<AccountUser> {
  const error = validateSignup(input);
  if (error) throw new Error(error);
  const salt = randomSalt();
  return {
    email: normalizeEmail(input.email),
    passwordHash: await hashPassword(input.password, salt),
    salt,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    createdAt: at,
    storeCreditCents: 0,
    creditLedger: [],
    addresses: [],
    stockAlerts: [],
    orders: [],
  };
}

function normalizeAddress(input: AddressInput, id: string, isDefault: boolean): SavedAddress {
  const error = validateAddress(input);
  if (error) throw new Error(error);
  return {
    id,
    label: input.label.trim() || "Address",
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    line1: input.line1.trim(),
    line2: (input.line2 ?? "").trim(),
    city: input.city.trim(),
    state: input.state as AuState,
    postcode: input.postcode.trim(),
    country: "AU",
    phone: (input.phone ?? "").trim(),
    isDefault,
  };
}

function withSingleDefault(addresses: SavedAddress[], defaultId: string) {
  return addresses.map((address) => ({
    ...address,
    isDefault: address.id === defaultId,
  }));
}

export function addAddress(
  user: AccountUser,
  input: AddressInput,
  id = newId(),
): AccountUser {
  const isDefault = input.isDefault === true || user.addresses.length === 0;
  const next = [...user.addresses, normalizeAddress(input, id, isDefault)];
  return {
    ...user,
    addresses: isDefault ? withSingleDefault(next, id) : next,
  };
}

export function updateAddress(
  user: AccountUser,
  id: string,
  input: AddressInput,
): AccountUser {
  if (!user.addresses.some((address) => address.id === id)) {
    throw new Error("Address was not found");
  }
  const keepDefault = user.addresses.find((address) => address.id === id)?.isDefault ?? false;
  const isDefault = input.isDefault === true || (keepDefault && input.isDefault !== false);
  const next = user.addresses.map((address) =>
    address.id === id ? normalizeAddress(input, id, isDefault) : address,
  );
  return {
    ...user,
    addresses: isDefault ? withSingleDefault(next, id) : next,
  };
}

export function removeAddress(user: AccountUser, id: string): AccountUser {
  const next = user.addresses.filter((address) => address.id !== id);
  if (next.length > 0 && !next.some((address) => address.isDefault)) {
    next[0] = { ...next[0], isDefault: true };
  }
  return { ...user, addresses: next };
}

export function setDefaultAddress(user: AccountUser, id: string): AccountUser {
  if (!user.addresses.some((address) => address.id === id)) {
    throw new Error("Address was not found");
  }
  return { ...user, addresses: withSingleDefault(user.addresses, id) };
}

export function addStockAlert(
  user: AccountUser,
  input: { slug: string; name: string; sku: string },
  at = new Date().toISOString(),
): AccountUser {
  if (user.stockAlerts.some((alert) => alert.slug === input.slug)) return user;
  const alert: StockAlert = {
    slug: input.slug,
    name: input.name,
    sku: input.sku,
    createdAt: at,
  };
  return { ...user, stockAlerts: [alert, ...user.stockAlerts] };
}

export function removeStockAlert(user: AccountUser, slug: string): AccountUser {
  return {
    ...user,
    stockAlerts: user.stockAlerts.filter((alert) => alert.slug !== slug),
  };
}

export function hasStockAlert(user: Pick<AccountUser, "stockAlerts">, slug: string) {
  return user.stockAlerts.some((alert) => alert.slug === slug);
}

export function debitStoreCredit(
  user: AccountUser,
  amountCents: number,
  note: string,
  orderId?: string,
  at = new Date().toISOString(),
  id = newId(),
): AccountUser {
  const amount = Math.max(0, Math.floor(amountCents));
  if (amount <= 0) return user;
  const applied = Math.min(amount, user.storeCreditCents);
  if (applied <= 0) return user;
  return {
    ...user,
    storeCreditCents: user.storeCreditCents - applied,
    creditLedger: [
      {
        id,
        at,
        amountCents: -applied,
        note,
        orderId,
      },
      ...user.creditLedger,
    ],
  };
}

export function grantStoreCredit(
  user: AccountUser,
  amountCents: number,
  note: string,
  orderId?: string,
  at = new Date().toISOString(),
  id = newId(),
): AccountUser {
  const amount = Math.max(0, Math.floor(amountCents));
  if (amount <= 0) return user;
  return {
    ...user,
    storeCreditCents: user.storeCreditCents + amount,
    creditLedger: [
      {
        id,
        at,
        amountCents: amount,
        note,
        orderId,
      },
      ...user.creditLedger,
    ],
  };
}

export function recordOrder(user: AccountUser, order: OrderRecord): AccountUser {
  if (user.orders.some((existing) => existing.id === order.id)) return user;
  if (
    order.stripeSessionId &&
    user.orders.some((existing) => existing.stripeSessionId === order.stripeSessionId)
  ) {
    return user;
  }
  const applied = Math.min(
    Math.max(0, user.storeCreditCents),
    Math.max(0, Math.floor(order.storeCreditCents)),
  );
  const withOrder: AccountUser = {
    ...user,
    orders: [order, ...user.orders],
  };
  if (applied <= 0) return withOrder;
  return debitStoreCredit(
    withOrder,
    applied,
    `Applied at checkout for order ${order.id}`,
    order.id,
    order.createdAt,
  );
}

export function mergeOrders(user: AccountUser, orders: OrderRecord[]): AccountUser {
  return orders.reduce((next, order) => {
    if (normalizeEmail(order.email) !== user.email) return next;
    return recordOrder(next, order);
  }, user);
}

export function formatAddress(address: Pick<SavedAddress, "line1" | "line2" | "city" | "state" | "postcode">) {
  return [address.line1, address.line2, `${address.city} ${address.state} ${address.postcode}`, "Australia"]
    .filter((part) => part && part.trim())
    .join(", ");
}

export function lineDisplayName(line: OrderLine) {
  if (!line.option) return line.name;
  return `${line.name} (${line.option})`;
}

export function coaMailto(order: OrderRecord, line: OrderLine) {
  const subject = `COA request — ${order.id} — ${line.sku || line.name}`;
  const body = [
    `Order: ${order.id}`,
    `Placed: ${order.createdAt}`,
    `Product: ${lineDisplayName(line)}`,
    `SKU: ${line.sku || "not listed"}`,
    `Qty: ${line.qty}`,
    "",
    "Please send the batch Certificate of Analysis for this line.",
  ].join("\n");
  return `mailto:redlinelabsltd@pm.me?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function trackingMailto(order: OrderRecord) {
  const subject = `Tracking request — ${order.id}`;
  const body = [
    `Order: ${order.id}`,
    `Placed: ${order.createdAt}`,
    "",
    "Please send the tracking number for this order when it has been dispatched.",
  ].join("\n");
  return `mailto:redlinelabsltd@pm.me?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function auspostTrackingUrl(trackingNumber: string) {
  return `https://auspost.com.au/mypost/track/#/details/${encodeURIComponent(trackingNumber)}`;
}
