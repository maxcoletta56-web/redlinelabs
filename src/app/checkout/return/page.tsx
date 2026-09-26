import type { Metadata } from "next";
import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { createNeonOrderStore, ordersConfigured } from "@/lib/orders-db";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Payment return",
  description: "Return from a card authentication step for a Redline Labs order.",
  path: "/checkout/return",
  index: false,
});

type Props = {
  searchParams: Promise<{ order?: string; status?: string }>;
};

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const { order: orderId, status } = await searchParams;
  const order =
    orderId && ordersConfigured() ? await createNeonOrderStore().get(orderId).catch(() => null) : null;

  if (status === "error") {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Card authentication failed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          3D Secure or the bank step did not finish. Start the card checkout again and the element will mount a new session.
        </p>
        <Link href="/checkout" className="btn">
          Try the card again
        </Link>
      </div>
    );
  }

  const paid = order?.status === "paid" || status === "success";
  const total = order ? formatPrice(order.totalCents / 100) : null;

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {paid && <ClearCartOnSuccess />}
      <p className="kicker mb-3">{order?.status === "paid" ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {order?.status === "failed" ? "Payment failed" : paid ? "Payment submitted" : "Confirming payment"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {order?.status === "paid"
          ? "Whop confirmed this card payment. A confirmation email is on its way."
          : order?.status === "failed"
            ? "Whop marked this card payment as failed. You can try again from checkout."
            : "If your bank asked you to authenticate the card, that step is finished. The order is marked paid when the Whop webhook arrives, and the confirmation email follows that."}
      </p>
      {total && <p className="mb-8 text-[15px] text-[#d4af37]">Amount {total} AUD</p>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={order ? `/checkout/success?order=${order.id}` : "/checkout"} className="btn">
          {order ? "View order" : "Return to checkout"}
        </Link>
        <Link href="/shop" className="btn-ghost">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
