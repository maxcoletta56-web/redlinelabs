import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteFallback } from "@/components/RouteFallback";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Sign in for full order history, store credit, saved addresses, and stock alerts.",
  robots: { index: false, follow: false },
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<RouteFallback label="Account" />}>{children}</Suspense>;
}
