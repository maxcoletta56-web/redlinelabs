import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhopCheckoutRetry } from "@/components/WhopCheckoutRetry";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { normalizeOrderReference } from "@/lib/order-reference";
import { findOrder } from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? reference;
  return pageMetadata({
    title: `Card payment ${normalized}`,
    description: "Card payment result for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function WhopReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const order = await findOrder(normalized).catch(() => null);
  if (!order) notFound();

  if (query.status === "error") {
    return (
      <div className="wrap max-w-[760px] py-16">
        <p className="kicker mb-3">Card</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
          Payment was not completed
        </h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The card payment failed or was canceled, including a 3D Secure challenge that was not
          finished. You can try the card again below. The amount is the total saved with this
          order.
        </p>
        <WhopCheckoutRetry reference={order.reference} email={order.email} />
      </div>
    );
  }

  const paid = order.status === "paid";
  const failed = order.status === "failed";

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {(paid || query.status === "success") && <ClearCartOnSuccess />}
      <p className="kicker mb-3">{paid ? "Paid" : "Card"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid ? "Thank you" : failed ? "Payment failed" : "Payment submitted"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? `Payment for ${order.reference} has cleared. A confirmation email is sent to ${order.email}.`
          : failed
            ? "Whop reported that this card payment failed. You can try again from checkout."
            : `Whop is confirming the charge for ${order.reference}. A confirmation email goes to ${order.email} when the payment succeeds.`}
      </p>
      <p className="mb-8 text-[15px] text-[#d4af37]">
        Amount {formatPrice(order.totalCents / 100)} {order.currency.toUpperCase()}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={`/order/${order.reference}`} className="btn">
          View order
        </Link>
        {failed && (
          <Link href={`/checkout/return/${order.reference}?status=error`} className="btn-ghost">
            Try the card again
          </Link>
        )}
      </div>
    </div>
  );
}
