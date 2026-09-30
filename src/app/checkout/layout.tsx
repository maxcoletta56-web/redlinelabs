import type { Metadata } from "next";
import Script from "next/script";
import { pageMetadata } from "@/lib/seo";
import { WHOP_CHECKOUT_LOADER } from "@/lib/whop";

export const metadata: Metadata = pageMetadata({
  title: "Checkout",
  description:
    "Pay for Redline Labs research chemicals. Research-use confirmation is required. Checkout pages are not indexed.",
  path: "/checkout",
  index: false,
});

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script src={WHOP_CHECKOUT_LOADER} strategy="afterInteractive" />
      {children}
    </>
  );
}
