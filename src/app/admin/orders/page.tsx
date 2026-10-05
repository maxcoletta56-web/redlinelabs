import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Field } from "@/components/Field";
import { loginAdmin, logoutAdmin, markAdminOrderPaid } from "@/app/admin/orders/actions";
import {
  ADMIN_RECENT_ORDER_LIMIT,
  adminDeskNotice,
  adminLoginError,
  adminOrderStats,
  customerEmailHref,
  customerName,
  firstQueryValue,
  formatAudCents,
  formatSydneyDateTime,
  gateAdminData,
  orderStatusLabel,
  promoLabel,
  sortAdminOrders,
  summarizeOrderItems,
} from "@/lib/admin-orders";
import { readAdminSessionToken } from "@/lib/admin-session";
import { normalizeOrderReference } from "@/lib/order-reference";
import { formatShippingAddress } from "@/lib/order-shipping";
import { listRecentOrders, ordersConfigured, type StoredOrder } from "@/lib/orders";
import { pageMetadata } from "@/lib/seo";

/** Payment state changes out of band, so this desk is never served from a cache. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Orders",
  description: "Private desk for recent Redline Labs orders. This page is not indexed.",
  path: "/admin/orders",
  index: false,
});

type SearchParams = {
  error?: string | string[];
  confirm?: string | string[];
  notice?: string | string[];
  reference?: string | string[];
};

type LoadResult = {
  orders: StoredOrder[];
  problem: "unavailable" | "failed" | null;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [token, params] = await Promise.all([readAdminSessionToken(), searchParams]);
  const gate = await gateAdminData(token, process.env.ADMIN_API_SECRET, loadAdminOrders);

  if (!gate.authorized) {
    return <AdminLogin message={adminLoginError(firstQueryValue(params.error))} />;
  }

  const confirm = normalizeOrderReference(firstQueryValue(params.confirm));
  return (
    <AdminDesk
      orders={gate.data.orders}
      problem={gate.data.problem}
      confirming={confirm}
      notice={adminDeskNotice(firstQueryValue(params.notice), firstQueryValue(params.reference))}
    />
  );
}

async function loadAdminOrders(): Promise<LoadResult> {
  if (!ordersConfigured()) return { orders: [], problem: "unavailable" };
  try {
    return {
      orders: sortAdminOrders(await listRecentOrders(ADMIN_RECENT_ORDER_LIMIT)),
      problem: null,
    };
  } catch (error) {
    console.error("[admin] list orders failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { orders: [], problem: "failed" };
  }
}

function AdminLogin({ message }: { message: string | null }) {
  return (
    <div className="wrap py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="kicker mb-3">Admin</p>
        <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Orders</h1>
        <p className="mt-3 text-[15px] leading-7 text-[#8f8c84]">
          Enter the admin secret to see bank-transfer orders.
        </p>
        <form action={loginAdmin} className="surface mt-8 space-y-4 p-5 sm:p-6">
          {message ? (
            <p role="alert" className="text-sm leading-6 text-[#d4af37]">
              {message}
            </p>
          ) : null}
          <Field
            id="admin-secret"
            name="secret"
            label="Admin secret"
            type="password"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <button type="submit" className="btn min-h-11 w-full">
            Unlock orders
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDesk({
  orders,
  problem,
  confirming,
  notice,
}: {
  orders: StoredOrder[];
  problem: LoadResult["problem"];
  confirming: string | null;
  notice: string | null;
}) {
  const stats = adminOrderStats(orders);
  const problemText =
    problem === "unavailable"
      ? "Orders are unavailable until the database is configured."
      : problem === "failed"
        ? "Could not list orders."
        : null;

  return (
    <div className="wrap py-10 sm:py-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <header>
          <p className="kicker mb-3">Admin</p>
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Orders</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#8f8c84]">
            Bank transfer and PayID orders. Mark one paid after the money lands.
          </p>
        </header>
        <form action={logoutAdmin}>
          <button type="submit" className="btn-ghost min-h-11 w-full sm:w-auto">
            Log out
          </button>
        </form>
      </div>

      {notice ? (
        <p
          role="status"
          className="mb-6 border border-[rgba(212,175,55,0.34)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm leading-6 text-[#f3f1ea]"
        >
          {notice}
        </p>
      ) : null}
      {problemText ? (
        <p role="alert" className="mb-6 border border-[rgba(212,175,55,0.34)] px-4 py-3 text-sm text-[#d4af37]">
          {problemText}
        </p>
      ) : (
        <section aria-label="Order counts" className="mb-8">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="Awaiting payment" value={String(stats.awaitingPayment)} />
            <Stat label="Paid today" value={String(stats.paidToday)} />
            <Stat label="Revenue paid today" value={formatAudCents(stats.revenuePaidTodayCents)} />
          </dl>
          <p className="mt-3 text-[12px] leading-5 text-[#8f8c84]">
            Latest {ADMIN_RECENT_ORDER_LIMIT} orders. Awaiting payment is listed first. Paid today
            follows the Sydney calendar.
          </p>
        </section>
      )}

      {problem ? null : (
        <div className="surface overflow-x-auto">
          <table className="block w-full text-left md:table md:min-w-[920px]">
            <caption className="sr-only">Recent orders</caption>
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-[rgba(212,175,55,0.16)] text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                <th className="px-4 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Placed</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Promo</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-sm text-[#8f8c84]">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <OrderRow
                    key={order.reference}
                    order={order}
                    confirming={confirming === order.reference && order.status !== "paid"}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4">
      <dt className="text-[11px] font-semibold tracking-[0.14em] text-[#8f8c84] uppercase">{label}</dt>
      <dd className="mt-2 text-[1.7rem] font-semibold tracking-[-0.03em] text-[#d4af37]">{value}</dd>
    </div>
  );
}

function OrderRow({ order, confirming }: { order: StoredOrder; confirming: boolean }) {
  const emailHref = customerEmailHref(order.email);
  return (
    <tr
      id={`order-${order.reference}`}
      className={`block scroll-mt-32 border-b border-[rgba(212,175,55,0.16)] px-4 py-4 last:border-b-0 md:table-row md:px-0 ${
        confirming ? "bg-[rgba(212,175,55,0.06)]" : ""
      }`}
    >
      <Cell label="Reference">
        <Link
          href={`/order/${order.reference}`}
          className="font-semibold tracking-[0.04em] text-white hover:text-[#d4af37]"
        >
          {order.reference}
        </Link>
      </Cell>
      <Cell label="Placed">
        <time dateTime={order.createdAt ?? undefined}>{formatSydneyDateTime(order.createdAt)}</time>
      </Cell>
      <Cell label="Customer">
        <p>{customerName(order.firstName, order.lastName)}</p>
        {emailHref ? (
          <a href={emailHref} className="mt-1 block break-all text-[#8f8c84] hover:text-[#d4af37]">
            {order.email}
          </a>
        ) : (
          <p className="mt-1 text-[#8f8c84]">—</p>
        )}
        <p className="mt-2 text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Ship to
        </p>
        <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#cfc8b8]">
          {formatShippingAddress(order.shipping)}
        </p>
      </Cell>
      <Cell label="Items">
        <p className="max-w-xs">{summarizeOrderItems(order.items)}</p>
      </Cell>
      <Cell label="Total">
        <p className="font-semibold text-[#d4af37]">{formatAudCents(order.totalCents)}</p>
      </Cell>
      <Cell label="Promo">
        <p>{promoLabel(order.promoCode)}</p>
      </Cell>
      <Cell label="Status">
        <StatusBadge status={order.status} />
        {order.status !== "paid" ? (
          <div className="mt-3">
            <MarkPaid reference={order.reference} confirming={confirming} />
          </div>
        ) : null}
      </Cell>
    </tr>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <td className="block py-1.5 align-top text-sm md:table-cell md:px-4 md:py-4">
      <span className="mb-1 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase md:hidden">
        {label}
      </span>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: string }) {
  const paid = status === "paid";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${
        paid
          ? "border border-white/15 text-[#f3f1ea]"
          : "border border-[#d4af37] bg-[rgba(212,175,55,0.14)] text-[#d4af37]"
      }`}
    >
      {orderStatusLabel(status)}
    </span>
  );
}

function MarkPaid({ reference, confirming }: { reference: string; confirming: boolean }) {
  if (!confirming) {
    return (
      <form method="get" action={`/admin/orders#order-${reference}`}>
        <input type="hidden" name="confirm" value={reference} />
        <button type="submit" className="btn min-h-11 w-full sm:w-auto">
          Mark paid
        </button>
      </form>
    );
  }
  return (
    <form action={markAdminOrderPaid} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="confirm" value="yes" />
      <p className="w-full text-sm text-[#f3f1ea]">Mark {reference} as paid?</p>
      <button type="submit" className="btn min-h-11 w-full sm:w-auto">
        Confirm paid
      </button>
      <Link href="/admin/orders" className="btn-ghost min-h-11 w-full sm:w-auto">
        Cancel
      </Link>
    </form>
  );
}
