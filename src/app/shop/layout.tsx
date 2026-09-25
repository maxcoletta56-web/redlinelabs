import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteFallback } from "@/components/RouteFallback";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Catalogue",
  description:
    "Browse Redline Labs research chemicals by name, SKU, or category. Prices in AUD. For laboratory research use only, not for human or veterinary use.",
  path: "/shop",
});

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback label="Catalogue" />}>{children}</Suspense>;
}
