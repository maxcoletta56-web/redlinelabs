import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
    title: `Checkout ${normalized}`,
    description: "Card checkout result for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function CheckoutReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();

  const status = query.status === "success" || query.status === "error" ? query.status : null;
  const succeeded = status === "success";

  return (
    <div className="wrap max-w-[760px] py-16">
      {succeeded ? <ClearCartOnSuccess /> : null}
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: normalized },
        ]}
      />
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase" role="status">
        {succeeded ? "Payment submitted" : status === "error" ? "Payment not completed" : "Checkout"}
      </p>
      <h1 className="mt-3 mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {succeeded ? "Card payment submitted" : "Try the card payment again"}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {succeeded
          ? `Whop has this payment for order ${normalized}. The order is marked paid, and the confirmation email is sent, only after payment.succeeded. A bank challenge such as 3D Secure returns here with that result.`
          : status === "error"
            ? "The card payment failed or the bank step was canceled. Nothing is marked paid. Start checkout again to load a new card form."
            : "This page is where Whop returns you after 3D Secure or another off-site step. Open the order if you already paid, or go back to checkout."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/order/${normalized}`} className="btn">
          View order
        </Link>
        {!succeeded && (
          <Link href="/checkout" className="btn-ghost">
            Back to checkout
          </Link>
        )}
      </div>
    </div>
  );
}
