import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSessionValue } from "./admin-auth.ts";
import {
  adminDeskNotice,
  adminLoginError,
  adminOrderStats,
  customerEmailHref,
  customerName,
  formatAudCents,
  formatSydneyDateTime,
  gateAdminData,
  paymentReceivedEmailDue,
  promoLabel,
  sortAdminOrders,
  summarizeOrderItems,
  sydneyCalendarDay,
} from "./admin-orders.ts";

const now = 1_700_000_000_000;

test("no cookie does not load order data", async () => {
  let calls = 0;
  const gate = await gateAdminData(
    undefined,
    "top-secret",
    async () => {
      calls += 1;
      return [{ email: "ada@example.com", totalCents: 16000 }];
    },
    now,
  );
  assert.deepEqual(gate, { authorized: false });
  assert.equal(calls, 0);
});

test("a cookie signed with the wrong secret is rejected and loads nothing", async () => {
  const token = createAdminSessionValue("top-secret", now);
  let calls = 0;
  const gate = await gateAdminData(
    token,
    "other-secret",
    async () => {
      calls += 1;
      return [{ email: "ada@example.com" }];
    },
    now,
  );
  assert.deepEqual(gate, { authorized: false });
  assert.equal(calls, 0);
  assert.equal(token.includes("top-secret"), false);
  assert.equal(token.includes("other-secret"), false);
});

test("a valid session cookie loads order data", async () => {
  const token = createAdminSessionValue("top-secret", now);
  const orders = [{ reference: "RL-234567", email: "ada@example.com", totalCents: 16000 }];
  const gate = await gateAdminData(token, "top-secret", async () => orders, now);
  assert.deepEqual(gate, { authorized: true, data: orders });
});

test("an expired session cookie loads nothing", async () => {
  const token = createAdminSessionValue("top-secret", now);
  let calls = 0;
  const gate = await gateAdminData(
    token,
    "top-secret",
    async () => {
      calls += 1;
      return [{ email: "ada@example.com" }];
    },
    now + 12 * 60 * 60 * 1000,
  );
  assert.deepEqual(gate, { authorized: false });
  assert.equal(calls, 0);
});

test("Sydney calendar day follows Australia/Sydney, including daylight saving", () => {
  assert.equal(sydneyCalendarDay("2026-09-27T14:05:00.000Z"), "2026-09-28");
  assert.equal(sydneyCalendarDay("2026-09-27T13:30:00.000Z"), "2026-09-27");
  assert.equal(sydneyCalendarDay("2026-01-15T13:30:00.000Z"), "2026-01-16");
  assert.equal(sydneyCalendarDay(null), null);
  assert.equal(sydneyCalendarDay("not-a-date"), null);
});

test("placed-at renders in Australia/Sydney local time", () => {
  assert.equal(formatSydneyDateTime("2026-09-27T14:05:00.000Z"), "28 Sept 2026, 12:05 am");
  assert.equal(formatSydneyDateTime("2026-01-15T13:30:00.000Z"), "16 Jan 2026, 12:30 am");
  assert.equal(formatSydneyDateTime(null), "—");
  assert.equal(formatSydneyDateTime("not-a-date"), "—");
});

test("totals format as AUD and items, names, and promos have empty states", () => {
  assert.equal(formatAudCents(16000), "$160.00");
  assert.equal(formatAudCents(199), "$1.99");
  assert.equal(formatAudCents(0), "$0.00");
  assert.equal(summarizeOrderItems([]), "—");
  assert.equal(
    summarizeOrderItems([
      { name: "BPC-157 (10mg)", qty: 2 },
      { name: "TB-500", qty: 1 },
    ]),
    "BPC-157 (10mg) × 2, TB-500 × 1",
  );
  assert.equal(customerName("Ada", "Lovelace"), "Ada Lovelace");
  assert.equal(customerName("  ", " "), "—");
  assert.equal(promoLabel("DGC20"), "DGC20");
  assert.equal(promoLabel("  "), "—");
  assert.equal(promoLabel(null), "—");
  assert.equal(customerEmailHref("ada@example.com"), "mailto:ada@example.com");
  assert.equal(customerEmailHref("not an email"), null);
});

test("counts put awaiting payment first and paid-today revenue on the Sydney day", () => {
  const today = new Date("2026-09-27T16:00:00.000Z");
  const orders = [
    {
      reference: "paid-new",
      status: "paid",
      createdAt: "2026-09-28T00:00:00.000Z",
      paidAt: "2026-09-27T15:00:00.000Z",
      totalCents: 16000,
    },
    {
      reference: "waiting-old",
      status: "awaiting_payment",
      createdAt: "2026-09-01T00:00:00.000Z",
      paidAt: null,
      totalCents: 5000,
    },
    {
      reference: "waiting-new",
      status: "awaiting_payment",
      createdAt: "2026-09-20T00:00:00.000Z",
      paidAt: null,
      totalCents: 9000,
    },
    {
      reference: "paid-yesterday",
      status: "paid",
      createdAt: "2026-09-26T00:00:00.000Z",
      paidAt: "2026-09-26T15:00:00.000Z",
      totalCents: 8000,
    },
  ];
  assert.deepEqual(
    sortAdminOrders(orders).map((order) => order.reference),
    ["waiting-new", "waiting-old", "paid-new", "paid-yesterday"],
  );
  assert.deepEqual(adminOrderStats(orders, today), {
    awaitingPayment: 2,
    paidToday: 1,
    revenuePaidTodayCents: 16000,
  });
  assert.deepEqual(
    orders.map((order) => order.reference),
    ["paid-new", "waiting-old", "waiting-new", "paid-yesterday"],
  );
});

test("a payment email is skipped only when the order was already paid", () => {
  assert.equal(paymentReceivedEmailDue("awaiting_payment"), true);
  assert.equal(paymentReceivedEmailDue(undefined), true);
  assert.equal(paymentReceivedEmailDue(null), true);
  assert.equal(paymentReceivedEmailDue("paid"), false);
});

test("login and desk messages do not echo the secret or an arbitrary query", () => {
  assert.equal(adminLoginError("rejected"), "That secret was not accepted.");
  assert.equal(adminLoginError("signed-out"), "Sign in again.");
  assert.equal(adminLoginError("limited")?.includes("top-secret"), false);
  assert.equal(adminLoginError("top-secret"), null);
  assert.equal(adminLoginError("<script>"), null);
  assert.equal(adminDeskNotice("paid", "RL-234567"), "Marked RL-234567 paid.");
  assert.equal(adminDeskNotice("paid", "top-secret"), "Payment recorded.");
  assert.equal(adminDeskNotice("nope", "RL-234567"), null);
  assert.equal(adminDeskNotice(undefined, undefined), null);
});
