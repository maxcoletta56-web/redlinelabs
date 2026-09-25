import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cart",
  description:
    "Review Redline Labs research-use catalogue items, quantities, and totals before checkout. This cart page is not indexed by search engines.",
  path: "/cart",
  index: false,
});

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
