import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Email Redline Labs at redlinelabsltd@pm.me for catalogue or order questions. Operated by RedlineLabs Limited, a registered Hong Kong company.",
  path: "/contact",
});

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
