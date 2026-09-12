import type { Metadata } from "next";
import Link from "next/link";
import Stripe from "stripe";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { formatPrice } from "@/lib/products";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Order received" };

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  let session: Stripe.Checkout.Session | null = null;

  if (sessionId && stripeConfigured()) {
    try {
      session = await getStripe().checkout.sessions.retrieve(sessionId);
    } catch {
      session = null;
    }
  }

  if (!session) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Payment not confirmed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          Stripe could not confirm this checkout session. If you paid, use the
          receipt email or contact support.
        </p>
        <Link href="/cart" className="btn">
          Return to cart
        </Link>
      </div>
    );
  }

  const paid = session.payment_status === "paid" || session.status === "complete";
  const total =
    typeof session.amount_total === "number" ? formatPrice(session.amount_total / 100) : null;

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {paid && <ClearCartOnSuccess />}
      <p className="kicker mb-3">{paid ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid ? "Thank you" : "Payment pending"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? "Stripe accepted this payment. A receipt is sent by Stripe to the email used at checkout."
          : "Stripe has not marked this session as paid yet. Refresh this page or check your email."}
      </p>
      {total && (
        <p className="mb-8 text-[15px] text-[#d4af37]">
          Amount {total} {session.currency?.toUpperCase()}
        </p>
      )}
      <Link href="/shop" className="btn">
        Continue browsing
      </Link>
    </div>
  );
}
