import type { Metadata } from "next";
import Link from "next/link";
import { CapturePaidOrder } from "@/components/CapturePaidOrder";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { createNeonOrderStore, ordersConfigured } from "@/lib/orders-db";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Order received",
  description: "Confirmation for a Redline Labs research-use order. This page is not indexed.",
  path: "/checkout/success",
  index: false,
});

type Props = { searchParams: Promise<{ order?: string; session_id?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = params.order || params.session_id || "";
  const order =
    orderId && ordersConfigured() ? await createNeonOrderStore().get(orderId).catch(() => null) : null;

  if (!order) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Order not found</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          If you paid by card, the confirmation email is sent when Whop reports the payment.
        </p>
        <Link href="/cart" className="btn">
          Return to cart
        </Link>
      </div>
    );
  }

  const paid = order.status === "paid";
  const total = formatPrice(order.totalCents / 100);

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {paid && <ClearCartOnSuccess />}
      {paid && <CapturePaidOrder sessionId={order.id} />}
      <p className="kicker mb-3">{paid ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid ? "Thank you" : order.status === "failed" ? "Payment failed" : "Payment pending"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? "This order is paid. A confirmation email is sent to the address used at checkout."
          : order.paymentMethod === "bank_transfer"
            ? `Bank transfer ${order.id} is pending until the transfer is matched.`
            : "Whop has not confirmed this card payment yet. Refresh this page after the webhook arrives."}
      </p>
      <p className="mb-8 text-[15px] text-[#d4af37]">Amount {total} AUD</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/account" className="btn">
          View account
        </Link>
        <Link href="/shop" className="btn-ghost">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
