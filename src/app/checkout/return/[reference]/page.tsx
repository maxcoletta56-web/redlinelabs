import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { findOrder } from "@/lib/orders";
import { normalizeOrderReference } from "@/lib/order-reference";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { checkoutReturnStatus } from "@/lib/whop-return";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? reference;
  return pageMetadata({
    title: `Payment ${normalized}`,
    description: "Card payment result for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function WhopCheckoutReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const order = await findOrder(normalized).catch(() => null);
  if (!order) notFound();

  const returned = checkoutReturnStatus(query.status);
  const paid = order.status === "paid" || returned === "success";
  const failed = returned === "error" || (order.status === "failed" && returned !== "success");

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {paid && !failed && <ClearCartOnSuccess />}
      <p className="kicker mb-3">{paid && !failed ? "Paid" : failed ? "Checkout" : "Confirming"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid && !failed ? "Thank you" : failed ? "Payment not completed" : "Confirming payment"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid && !failed
          ? `Order ${order.reference} is recorded. A confirmation email is sent when Whop reports the payment. Research-use goods are not for human consumption.`
          : failed
            ? "The card payment did not finish. 3D Secure can fail or be cancelled. Nothing further is charged. Start the card checkout again to try a different card."
            : `Order ${order.reference} is waiting for Whop to confirm the payment. This page can be refreshed.`}
      </p>
      <p className="mb-8 text-[15px] text-[#d4af37]">
        {formatPrice(order.totalCents / 100)} {order.currency.toUpperCase()}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {failed ? (
          <Link href="/checkout" className="btn">
            Try the card again
          </Link>
        ) : (
          <Link href={`/order/${order.reference}`} className="btn">
            View order
          </Link>
        )}
        <Link href="/shop" className="btn-ghost">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
