import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { WhopReturnStatus } from "@/components/WhopCheckout";
import { normalizeOrderReference } from "@/lib/order-reference";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { whopEnvironmentName } from "@/lib/whop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Card checkout",
  description: "Status of a Redline Labs card payment. This page is not indexed.",
  path: "/checkout/return",
  index: false,
});

type Props = {
  searchParams: Promise<{
    reference?: string | string[];
    status?: string | string[];
    client_secret?: string | string[];
  }>;
};

function one(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || null;
}

/**
 * Whop sends the buyer here after 3D Secure or any other off-site step.
 * `status` and `client_secret` only decide which prompt to show. The order
 * is marked paid only by the signed webhook.
 */
export default async function CheckoutReturnPage({ searchParams }: Props) {
  const params = await searchParams;
  const reference = normalizeOrderReference(one(params.reference) ?? "");
  const status = one(params.status);
  const clientSecret = one(params.client_secret);
  const returnUrl = reference
    ? absoluteUrl(`/checkout/return?reference=${encodeURIComponent(reference)}`)
    : absoluteUrl("/checkout/return");

  return (
    <div className="wrap max-w-[760px] py-16">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: "Card payment" },
        ]}
      />
      <p className="kicker mb-3">Card payment</p>
      <h1 className="mb-6 text-[2.15rem] font-semibold tracking-[-0.03em]">Checkout</h1>
      <WhopReturnStatus
        reference={reference}
        status={status}
        clientSecret={clientSecret}
        environment={whopEnvironmentName()}
        returnUrl={returnUrl}
      />
      <p className="mt-8 text-sm leading-6 text-[#8f8c84]">
        <Link href="/checkout" className="text-[#d4af37]">
          Return to checkout
        </Link>
      </p>
    </div>
  );
}
