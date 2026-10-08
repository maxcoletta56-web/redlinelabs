import type { Metadata } from "next";
import Link from "next/link";
import { WhopReturn } from "@/app/checkout/return/WhopReturn";
import { normalizeOrderReference } from "@/lib/order-reference";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Card payment",
  description:
    "Return page for a Redline Labs card payment after Whop checkout, including 3D Secure. This page is not indexed.",
  path: "/checkout/return",
  index: false,
});

type Props = {
  searchParams: Promise<{ order?: string | string[]; status?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckoutReturnPage({ searchParams }: Props) {
  const query = await searchParams;
  const reference = normalizeOrderReference(first(query.order));
  const status = first(query.status)?.trim().toLowerCase() || null;
  if (!reference) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
          Payment not confirmed
        </h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          This return did not include an order reference. If you paid, use the confirmation
          email.
        </p>
        <Link href="/checkout" className="btn">
          Return to checkout
        </Link>
      </div>
    );
  }
  return <WhopReturn reference={reference} status={status} />;
}
