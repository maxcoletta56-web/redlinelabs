import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { WhopCheckoutReturn } from "@/components/WhopCheckoutReturn";
import { normalizeOrderReference } from "@/lib/order-reference";
import { pageMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  const normalized = normalizeOrderReference(reference) ?? "order";
  return pageMetadata({
    title: "Card checkout",
    description: "Return from card verification for a Redline Labs order. This page is not indexed.",
    path: `/checkout/return/${normalized}`,
    index: false,
  });
}

export default async function CheckoutReturnPage({ params, searchParams }: Props) {
  const [{ reference }, query] = await Promise.all([params, searchParams]);
  const normalized = normalizeOrderReference(reference);
  if (!normalized) notFound();
  const statusValue = Array.isArray(query.status) ? query.status[0] : query.status;

  return (
    <div className="wrap max-w-[760px] py-16">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: "Card payment" },
        ]}
      />
      <p className="kicker mb-3">Order {normalized}</p>
      <h1 className="mb-6 text-[2.15rem] font-semibold tracking-[-0.03em]">Card payment</h1>
      <WhopCheckoutReturn reference={normalized} status={statusValue ?? ""} />
    </div>
  );
}
