import type { Metadata } from "next";
import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { getOrderStore, OrdersUnavailableError } from "@/lib/orders-db";
import { isOrderId } from "@/lib/orders";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Order received",
  description:
    "Confirmation for a Redline Labs research-use order. Card payments are confirmed by Whop. This page is not indexed.",
  path: "/checkout/return",
  index: false,
});

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ orderId?: string; status?: string }> };

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const { orderId = "", status = "" } = await searchParams;
  const failed = status === "error";

  if (failed) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Payment not completed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The card payment was declined, or the bank verification step was canceled. You can try
          again from checkout.
        </p>
        <Link href="/checkout" className="btn">
          Return to checkout
        </Link>
      </div>
    );
  }

  let order: { id: string; status: string; totalCents: number } | null = null;
  if (isOrderId(orderId)) {
    try {
      const store = await getOrderStore();
      const stored = await store.get(orderId);
      if (stored) order = { id: stored.id, status: stored.status, totalCents: stored.totalCents };
    } catch (error) {
      if (!(error instanceof OrdersUnavailableError)) throw error;
    }
  }

  const paid = order?.status === "paid";
  const paymentFailed = order?.status === "failed";

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {(paid || status === "success") && <ClearCartOnSuccess />}
      <p className="kicker mb-3">{paid ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid ? "Thank you" : paymentFailed ? "Payment failed" : "Payment received"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? "Whop confirmed this card payment. A confirmation email is sent to the address used at checkout."
          : paymentFailed
            ? "Whop reported that this card payment failed. You can try again from checkout."
            : "If the bank asked you to verify the card, that step is finished when you land here with a success status. The order stays pending until the payment.succeeded webhook marks it paid and sends the confirmation email."}
      </p>
      {order && (
        <p className="mb-8 text-[15px] text-[#d4af37]">
          Order {order.id} · {formatPrice(order.totalCents / 100)} AUD
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/account" className="btn">
          View account
        </Link>
        {paymentFailed ? (
          <Link href="/checkout" className="btn-ghost">
            Try checkout again
          </Link>
        ) : (
          <Link href="/shop" className="btn-ghost">
            Continue browsing
          </Link>
        )}
      </div>
    </div>
  );
}
