import type { Metadata } from "next";
import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { normalizeOrderReference } from "@/lib/order-reference";
import { pageMetadata } from "@/lib/seo";
import { whopReturnStatus } from "@/lib/whop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Card payment",
  description:
    "Result of a Redline Labs card payment. This checkout page is not indexed.",
  path: "/checkout/complete",
  index: false,
});

type Props = { searchParams: Promise<{ status?: string; order?: string }> };

export default async function CheckoutCompletePage({ searchParams }: Props) {
  const params = await searchParams;
  const status = whopReturnStatus(params.status);
  const reference = normalizeOrderReference(params.order);
  const succeeded = status === "success";

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {succeeded && <ClearCartOnSuccess />}
      <p className="kicker mb-3">{succeeded ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {succeeded ? "Payment submitted" : status === "error" ? "Payment not completed" : "Payment pending"}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {succeeded
          ? "Whop accepted the card payment. A confirmation email is sent when the payment is recorded. The order page shows the status."
          : status === "error"
            ? "The card payment was declined, or a 3D Secure or bank step was cancelled. You can try the card again from checkout. Nothing further is charged for this attempt until a new payment succeeds."
            : "Whop has not reported a final status for this card payment yet. Refresh this page after you finish the bank or 3D Secure step, or open the order page."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reference && (
          <Link href={`/order/${reference}`} className="btn">
            View order
          </Link>
        )}
        {!succeeded && (
          <Link href="/checkout" className="btn">
            Try the card again
          </Link>
        )}
        <Link href="/shop" className="btn-ghost">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
