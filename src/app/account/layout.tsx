import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteFallback } from "@/components/RouteFallback";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Account",
  description:
    "Sign in to keep Redline Labs order history, saved addresses, and restock watches in this browser. Account pages are not indexed.",
  path: "/account",
  index: false,
});

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<RouteFallback label="Account" />}>{children}</Suspense>;
}
