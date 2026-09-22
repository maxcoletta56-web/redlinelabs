import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Email Redline Labs at redlinelabsltd@pm.me. Operated by RedlineLabs Limited, a verified registered private corporation in Hong Kong.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
