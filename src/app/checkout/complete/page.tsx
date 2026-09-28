import type { Metadata } from "next";
import { CheckoutReturn } from "@/components/CheckoutReturn";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Card payment",
  description: "Return page for a Redline Labs card payment. This page is not indexed.",
  path: "/checkout/complete",
  index: false,
});

type Props = { searchParams: Promise<{ status?: string; order?: string }> };

export default async function CheckoutCompletePage({ searchParams }: Props) {
  const params = await searchParams;
  return <CheckoutReturn status={params.status ?? ""} orderReference={params.order ?? ""} />;
}
