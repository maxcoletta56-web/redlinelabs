import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { normalizeOrderReference } from "@/lib/order-reference";
import { pageMetadata } from "@/lib/seo";
import { checkoutReturnOutcome } from "@/lib/whop";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? reference;
  return pageMetadata({
    title: `Card checkout ${normalized}`,
    description: "Card payment return for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function CheckoutReturnPage({ params, searchParams }: Props) {
  const { reference } = await params;
  const { status } = await searchParams;
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const outcome = checkoutReturnOutcome(status);
  const succeeded = outcome === "success";

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {succeeded && <ClearCartOnSuccess />}
      <p className="kicker mb-3">Checkout</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {succeeded ? "Payment submitted" : outcome === "error" ? "Card authentication failed" : "Payment not confirmed"}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {succeeded
          ? `Order ${normalized} is waiting for Whop to confirm the charge. If your bank asked you to approve the payment, that step is finished. A confirmation email is sent when the payment succeeds.`
          : outcome === "error"
            ? "The card authentication did not finish, or the payment was declined. Nothing is marked paid until Whop confirms a charge. Start checkout again to try the card."
            : `Whop did not report a finished card step for order ${normalized}. Check the order page, or start checkout again.`}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={`/order/${normalized}`} className="btn">
          View order
        </Link>
        {outcome !== "success" && (
          <Link href="/checkout" className="btn-ghost">
            Return to checkout
          </Link>
        )}
      </div>
    </div>
  );
}
