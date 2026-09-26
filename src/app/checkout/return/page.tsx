import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutReturn } from "@/components/CheckoutReturn";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Card payment",
  description: "Return page for a Redline Labs card payment. Checkout pages are not indexed.",
  path: "/checkout/return",
  index: false,
});

export default function CheckoutReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap max-w-[700px] py-20 text-center">
          <p className="text-sm text-[#8f8c84]">Checking the card payment.</p>
        </div>
      }
    >
      <CheckoutReturn />
    </Suspense>
  );
}
