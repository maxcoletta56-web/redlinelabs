import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Checkout",
  description:
    "Pay for Redline Labs research chemicals through Payoneer. Research-use confirmation is required. Checkout pages are not indexed.",
  path: "/checkout",
  index: false,
});

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
