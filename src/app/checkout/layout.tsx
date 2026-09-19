import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Pay for Redline Labs research chemicals through Stripe. Research-use confirmation is required.",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
