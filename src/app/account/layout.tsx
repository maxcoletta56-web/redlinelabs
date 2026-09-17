import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Account",
  description:
    "Sign in for full order history, store credit, saved addresses, and stock alerts.",
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
