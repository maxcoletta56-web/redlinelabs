import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { resolveBankTransfer, transferDescription } from "@/lib/bank-transfer";
import { COMPANY_EMAIL } from "@/lib/company";
import { normalizeOrderReference } from "@/lib/order-reference";
import { formatShippingAddress } from "@/lib/order-shipping";
import { findOrder, type StoredOrder } from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

/** Payment clears out of band, so the status must never be served from a cache. */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? reference;
  return pageMetadata({
    title: `Order ${normalized}`,
    description:
      "Bank transfer payment instructions for a Redline Labs research-use order. This page is not indexed.",
    path: `/order/${normalized}`,
    index: false,
  });
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  }).format(date);
}

function StatusBadge({ order }: { order: StoredOrder }) {
  const label =
    order.status === "paid"
      ? "Payment received"
      : order.status === "failed"
        ? "Payment failed"
        : order.status === "pending"
          ? "Payment pending"
          : "Awaiting payment";
  return (
    <p
      className="text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase"
      role="status"
    >
      {label}
    </p>
  );
}

export default async function OrderPage({ params }: Props) {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const order = await findOrder(normalized).catch((error: unknown) => {
    console.error("[order] lookup failed", {
      reference: normalized,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  if (!order) notFound();

  const paid = order.status === "paid";
  const failed = order.status === "failed";
  const pending = order.status === "pending";
  const bank = resolveBankTransfer(process.env);
  const placedAt = formatDate(order.createdAt);
  const paidAt = formatDate(order.paidAt);

  return (
    <div className="wrap max-w-[760px] py-16">
      <ClearCartOnSuccess />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
          { label: `Order ${order.reference}` },
        ]}
      />
      <StatusBadge order={order} />
      <h1 className="mt-3 mb-2 text-[2.15rem] font-semibold tracking-[-0.03em]">
        Order {order.reference}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? `Payment for this order has cleared${paidAt ? ` on ${paidAt}` : ""}. It is queued for dispatch.`
          : failed
            ? "The card payment did not complete. You can return to checkout and try the card again, or pay by bank transfer."
            : pending
              ? "The card payment is pending. This page updates when Whop confirms it, and a confirmation email is sent then."
              : "Transfer the amount below and quote the order reference in the description. The order ships once payment clears, usually the same business day."}
      </p>

      <section className="surface mb-8 p-6" aria-labelledby="order-summary">
        <h2
          id="order-summary"
          className="mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase"
        >
          Summary
        </h2>
        <ul className="mb-4 space-y-3 text-sm">
          {order.items.map((item, index) => (
            <li key={`${item.slug}-${item.option}-${index}`} className="flex justify-between gap-4">
              <span>
                {item.name} × {item.qty}
              </span>
              <span className="text-[#d4af37]">
                {formatPrice((item.unitAmountCents * item.qty) / 100)}
              </span>
            </li>
          ))}
        </ul>
        {order.subtotalCents > order.totalCents && (
          <div className="mb-3 flex justify-between text-sm">
            <span>{order.promoCode ? `Discounts · ${order.promoCode}` : "Discount"}</span>
            <span className="text-[#d4af37]">
              −{formatPrice((order.subtotalCents - order.totalCents) / 100)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4">
          <span>{paid ? "Paid" : "Amount due"}</span>
          <span className="text-[#d4af37]">
            {formatPrice(order.totalCents / 100)} {order.currency.toUpperCase()}
          </span>
        </div>
        <dl className="mt-4 space-y-1 text-xs leading-6 text-[#8f8c84]">
          <div className="flex gap-2">
            <dt>Ordered by</dt>
            <dd className="text-[#cfc8b8]">
              {`${order.firstName} ${order.lastName}`.trim()} · {order.email}
            </dd>
          </div>
          {placedAt && (
            <div className="flex gap-2">
              <dt>Placed</dt>
              <dd className="text-[#cfc8b8]">{placedAt}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt>Ship to</dt>
            <dd className="whitespace-pre-line text-[#cfc8b8]">
              {formatShippingAddress(order.shipping)}
            </dd>
          </div>
        </dl>
      </section>

      {!paid && !pending && !failed && (
        <section className="surface mb-8 p-6" aria-labelledby="payment-instructions">
          <h2
            id="payment-instructions"
            className="mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase"
          >
            How to pay
          </h2>
          {bank ? (
            <>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] tracking-[0.12em] text-[#8f8c84] uppercase">PayID</dt>
                  <dd className="text-[15px] text-[#d4af37]">{bank.payId}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.12em] text-[#8f8c84] uppercase">
                    Account name
                  </dt>
                  <dd className="text-[15px] text-[#cfc8b8]">{bank.accountName}</dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.12em] text-[#8f8c84] uppercase">Amount</dt>
                  <dd className="text-[15px] text-[#d4af37]">
                    {formatPrice(order.totalCents / 100)} {order.currency.toUpperCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] tracking-[0.12em] text-[#8f8c84] uppercase">
                    Transfer description
                  </dt>
                  <dd className="text-[15px] text-[#d4af37]">
                    {transferDescription(order.reference)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-[#8f8c84]">
                Send the exact amount from an Australian bank account using PayID or a standard
                transfer. The reference in the description is how the payment is matched to this
                order, so include it. The order ships once payment clears, usually the same business
                day.
              </p>
            </>
          ) : (
            <p className="text-sm leading-6 text-[#d4af37]" role="status">
              Payment details are not published yet. Email{" "}
              <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37]">
                {COMPANY_EMAIL}
              </a>{" "}
              quoting {order.reference} and we will send transfer instructions.
            </p>
          )}
        </section>
      )}

      <p className="mb-8 text-sm leading-6 text-[#8f8c84]">
        Keep this page bookmarked to check the status. Questions about this order go to{" "}
        <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37]">
          {COMPANY_EMAIL}
        </a>
        .
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/shop" className="btn">
          Continue browsing
        </Link>
        <Link href="/contact" className="btn-ghost">
          Contact support
        </Link>
      </div>
    </div>
  );
}
