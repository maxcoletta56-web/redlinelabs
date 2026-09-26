import type { Metadata } from "next";
import Link from "next/link";
import { CapturePaidOrder } from "@/components/CapturePaidOrder";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { OrderStatusRefresh } from "@/components/OrderStatusRefresh";
import { loadPayoneerReceipt } from "@/lib/checkout-session";
import { getOrderStore } from "@/lib/order-store";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { bankTransferDetails } from "@/lib/whop-config";

export const metadata: Metadata = pageMetadata({
  title: "Order received",
  description:
    "Confirmation for a Redline Labs research-use order. Card payments are confirmed by Whop. This checkout success page is not indexed.",
  path: "/checkout/success",
  index: false,
});

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ session_id?: string; order_id?: string; status?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderId = params.order_id || params.session_id || "";
  const returned = params.status;
  const order = orderId ? await getOrderStore().get(orderId) : null;

  if (order) {
    const paid = order.status === "paid";
    const failed = !paid && (returned === "error" || order.status === "failed");
    const total = formatPrice(order.totalCents / 100);
    const bank = bankTransferDetails(process.env);
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        {paid && <ClearCartOnSuccess />}
        {paid && <CapturePaidOrder sessionId={order.id} />}
        {!paid && !failed && order.paymentMethod === "card" && <OrderStatusRefresh orderId={order.id} />}
        <p className="kicker mb-3">{paid ? "Paid" : failed ? "Checkout" : "Pending"}</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
          {paid ? "Thank you" : failed ? "Payment not completed" : "Order received"}
        </h1>
        <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
          {paid
            ? "Whop confirmed this card payment. A confirmation email is sent to the address used at checkout. Signed-in orders, COA requests, and tracking appear on your account."
            : failed
              ? "The card payment failed, or 3D Secure was not completed. You can return to checkout and load the card form again."
              : order.paymentMethod === "bank_transfer"
                ? `Bank transfer order ${order.id} is pending. Transfer ${total} AUD and use the order ID as the reference.`
                : "The card form returned here. This page marks the order paid only after Whop sends payment.succeeded."}
        </p>
        {!paid && !failed && order.paymentMethod === "bank_transfer" && bank.accountName && bank.bsb && bank.accountNumber && (
          <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
            {bank.accountName} · BSB {bank.bsb} · {bank.accountNumber}
          </p>
        )}
        <p className="mb-8 text-[15px] text-[#d4af37]">
          {order.id} · {total} AUD
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {failed && (
            <Link href={`/checkout?status=error&order_id=${encodeURIComponent(order.id)}`} className="btn">
              Try card payment again
            </Link>
          )}
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

  const loaded = params.session_id ? await loadPayoneerReceipt(params.session_id).catch(() => null) : null;
  if (!loaded) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Payment not confirmed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          This checkout could not be confirmed. If you paid, use the confirmation
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
          ? "This earlier payment was confirmed. Signed-in orders, COA requests, and tracking appear on your account."
          : "This payment has not been marked as charged yet. Refresh this page or check your email."}
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
