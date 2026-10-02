import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { normalizeOrderReference } from "@/lib/order-reference";
import { pageMetadata } from "@/lib/seo";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? reference;
  return pageMetadata({
    title: `Card payment ${normalized}`,
    description: "Card payment return for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function WhopCheckoutReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const status = (query.status ?? "").toLowerCase();
  const succeeded = status === "success";
  const failed = status === "error";

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {succeeded && <ClearCartOnSuccess />}
      <p className="kicker mb-3">Card payment</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {succeeded ? "Payment submitted" : failed ? "Payment not completed" : "Confirming payment"}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {succeeded
          ? `Order ${normalized} is waiting for Whop to confirm the charge. The confirmation email is sent when the payment succeeds. 3D Secure and other bank checks return here.`
          : failed
            ? "The card issuer did not complete 3D Secure, or the payment was cancelled. Nothing has been marked paid. Start the card checkout again to try another card."
            : `Order ${normalized} is still being confirmed. Refresh the order page if the confirmation email has not arrived.`}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href={`/order/${normalized}`} className="btn">
          View order
        </Link>
        {failed ? (
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
