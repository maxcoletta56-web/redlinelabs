import type { Metadata } from "next";
import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { normalizeOrderReference } from "@/lib/order-reference";
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
    description: "Return page for a Redline Labs card payment. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function CardCheckoutReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  const status = query.status === "success" || query.status === "error" ? query.status : null;

  if (!normalized) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Payment not confirmed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          This return link does not match an order reference.
        </p>
        <Link href="/checkout" className="btn">
          Return to checkout
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Card</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Card payment not completed</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The bank step was cancelled or declined, including a 3D Secure check that did not finish.
          Order {normalized} stays unpaid. Start the card form again to try another payment.
        </p>
        <Link href="/checkout" className="btn">
          Try the card again
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {status === "success" && <ClearCartOnSuccess />}
      <p className="kicker mb-3">Card</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {status === "success" ? "Payment submitted" : "Checking the card payment"}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {status === "success"
          ? `Whop sent you back after the card step for order ${normalized}. The order is marked paid when the payment confirmation arrives, and the receipt email is sent then.`
          : `If the bank finished verifying the card for order ${normalized}, the receipt email follows once Whop confirms the payment.`}
      </p>
      <Link href={`/order/${normalized}`} className="btn">
        View order
      </Link>
    </div>
  );
}
