import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteFallback } from "@/components/RouteFallback";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Browse laboratory research chemicals listed by Redline Labs. Search by name, SKU, or category. Research use only.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteFallback label="Catalogue" />}>{children}</Suspense>;
}
