import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Laboratory research chemicals listed by Redline Labs. For laboratory research use only.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
