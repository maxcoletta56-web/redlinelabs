import type { Metadata } from "next";
import Link from "next/link";
import { CapturePaidOrder } from "@/components/CapturePaidOrder";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { loadPayoneerReceipt } from "@/lib/checkout-session";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Order received",
  description:
    "Confirmation for a Redline Labs research-use order paid through Payoneer. This checkout success page is not indexed.",
  path: "/checkout/success",
  index: false,
});

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  const loaded = await loadPayoneerReceipt(sessionId).catch(() => null);

  if (!loaded) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Payment not confirmed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          Payoneer could not confirm this checkout. If you paid, use the receipt
          email or contact support.
        </p>
        <Link href="/cart" className="btn">
          Return to cart
        </Link>
      </div>
    );
  }

  const { receipt, paid } = loaded;
  const total = formatPrice(receipt.amountCents / 100);

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {paid && <ClearCartOnSuccess />}
      {paid && <CapturePaidOrder sessionId={receipt.transactionId} />}
      <p className="kicker mb-3">{paid ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid ? "Thank you" : "Payment pending"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? "Payoneer accepted this payment. A receipt is sent by Payoneer to the email used at checkout. Signed-in orders, COA requests, and tracking appear on your account."
          : "Payoneer has not marked this payment as charged yet. Refresh this page or check your email."}
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
