import { adminSessionValid } from "./admin-auth.ts";
import { normalizeOrderReference } from "./order-reference.ts";

/** Same window the JSON admin list uses. */
export const ADMIN_RECENT_ORDER_LIMIT = 50;

const SYDNEY_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SYDNEY_DATE_TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  dateStyle: "medium",
  timeStyle: "short",
});

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export type AdminGate<T> = { authorized: false } | { authorized: true; data: T };

/**
 * Loads order data only after the session cookie checks out.
 * A missing or rejected cookie never calls `load`.
 */
export async function gateAdminData<T>(
  token: string | null | undefined,
  secret: string | undefined,
  load: () => Promise<T>,
  now = Date.now(),
): Promise<AdminGate<T>> {
  if (!adminSessionValid(token, secret, now)) return { authorized: false };
  return { authorized: true, data: await load() };
}

export function sydneyCalendarDay(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return SYDNEY_DAY.format(date);
}

export function formatSydneyDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return SYDNEY_DATE_TIME.format(date);
}

export function formatAudCents(cents: number): string {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  return AUD.format(amount);
}

export function customerName(firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  return name || "—";
}

/** mailto only for a single ordinary address, so a stored value cannot change the link scheme. */
export function customerEmailHref(email: string): string | null {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

export function summarizeOrderItems(items: { name: string; qty: number }[]): string {
  if (items.length === 0) return "—";
  return items
    .map((item) => {
      const name = item.name.trim() || "Item";
      const qty = Number.isFinite(item.qty) ? item.qty : 0;
      return `${name} × ${qty}`;
    })
    .join(", ");
}

export function promoLabel(code: string | null): string {
  const trimmed = code?.trim() ?? "";
  return trimmed || "—";
}

export function orderStatusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "pending") return "Pending";
  if (status === "failed") return "Failed";
  return status;
}

export function orderCanBeMarkedPaid(status: string) {
  return status === "awaiting_payment" || status === "pending" || status === "failed";
}

export type AdminOrderStats = {
  awaitingPayment: number;
  paidToday: number;
  revenuePaidTodayCents: number;
};

export function adminOrderStats(
  orders: { status: string; paidAt: string | null; totalCents: number }[],
  now = new Date(),
): AdminOrderStats {
  const today = sydneyCalendarDay(now);
  let awaitingPayment = 0;
  let paidToday = 0;
  let revenuePaidTodayCents = 0;
  for (const order of orders) {
    if (order.status === "awaiting_payment") awaitingPayment += 1;
    if (order.status === "paid" && today && sydneyCalendarDay(order.paidAt) === today) {
      paidToday += 1;
      revenuePaidTodayCents += order.totalCents;
    }
  }
  return { awaitingPayment, paidToday, revenuePaidTodayCents };
}

export function sortAdminOrders<T extends { status: string; createdAt: string | null }>(
  orders: readonly T[],
): T[] {
  return [...orders].sort((a, b) => {
    const rank = (status: string) => (orderCanBeMarkedPaid(status) ? 0 : 1);
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
  });
}

function createdAtMs(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function adminLoginError(code: string | undefined): string | null {
  if (code === "rejected") return "That secret was not accepted.";
  if (code === "limited") return "Too many attempts. Try again in a few minutes.";
  if (code === "signed-out") return "Sign in again.";
  return null;
}

/** Allowlisted notices. A paid reference is shown only when it is a real order reference. */
export function adminDeskNotice(notice: string | undefined, reference: string | undefined): string | null {
  switch (notice) {
    case "paid": {
      const normalized = normalizeOrderReference(reference);
      return normalized ? `Marked ${normalized} paid.` : "Payment recorded.";
    }
    case "missing":
      return "That order was not found.";
    case "invalid":
      return "That reference is not valid.";
    case "unavailable":
      return "Orders are unavailable until the database is configured.";
    case "failed":
      return "Could not update that order.";
    default:
      return null;
  }
}

export function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
