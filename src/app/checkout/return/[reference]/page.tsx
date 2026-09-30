import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { findOrder } from "@/lib/orders";
import { normalizeOrderReference } from "@/lib/order-reference";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { findWhopCheckout, whopReturnPath } from "@/lib/whop-checkout";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

function firstStatus(status: string | string[] | undefined) {
  const value = Array.isArray(status) ? status[0] : status;
  return value === "success" || value === "error" ? value : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? "order";
  return pageMetadata({
    title: "Card checkout",
    description: "Card payment result for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function WhopReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const status = firstStatus(query.status);
  const [checkout, order] = await Promise.all([
    findWhopCheckout(normalized).catch(() => null),
    findOrder(normalized).catch(() => null),
  ]);

  if (status === "success") {
    return (
      <div className="wrap max-w-[700px] py-20">
        <ClearCartOnSuccess />
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Payment submitted</h1>
        <p className="mb-6 text-sm leading-7 text-[#8f8c84]">
          Order {normalized} is pending until Whop confirms the card payment. A confirmation
          email is sent when the payment succeeds. This page does not mark the order paid.
        </p>
        <Link href={`/order/${normalized}`} className="btn">
          View order
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[700px] py-16">
      <p className="kicker mb-3">Checkout</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {status === "error" ? "Try the card again" : "Card checkout"}
      </h1>
      <p className="mb-6 text-sm leading-7 text-[#8f8c84]">
        {status === "error"
          ? "The card payment did not complete, or it was canceled during 3D Secure. Nothing is marked paid. The checkout is mounted again so you can retry."
          : `Order ${normalized} stays pending until the card payment succeeds.`}
        {order ? ` Amount due ${order.currency.toUpperCase()} is stored with the order.` : ""}
      </p>
      {checkout ? (
        <WhopCheckoutElement
          planId={checkout.planId}
          sessionId={checkout.sessionId}
          returnUrl={absoluteUrl(whopReturnPath(normalized))}
          environment={checkout.environment}
          email={order?.email ?? ""}
          shipping={
            order?.shipping
              ? {
                  name: order.shipping.name,
                  line1: order.shipping.line1,
                  line2: order.shipping.line2,
                  city: order.shipping.city,
                  state: order.shipping.state,
                  postal_code: order.shipping.postcode,
                  country: order.shipping.country,
                }
              : null
          }
        />
      ) : (
        <p className="text-sm leading-6 text-[#d4af37]" role="status">
          This card session is no longer available.{" "}
          <Link href="/checkout" className="text-[#d4af37]">
            Return to checkout
          </Link>{" "}
          to start again. Nothing has been marked paid.
        </p>
      )}
    </div>
  );
}
