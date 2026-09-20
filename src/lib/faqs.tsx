import type { ReactNode } from "react";
import Link from "next/link";

export const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "What are these products for?",
    a: "They are sold for laboratory research only. They are not for human or veterinary consumption and are not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.",
  },
  {
    q: "Do you ship Australia-wide?",
    a: (
      <>
        This storefront lists Australia-wide dispatch. See the{" "}
        <Link href="/shipping-policy" className="text-[#d4af37] underline underline-offset-2">
          shipping policy
        </Link>{" "}
        for processing notes.
      </>
    ),
  },
  {
    q: "Are certificates of analysis available?",
    a: (
      <>
        COAs are not currently published on product pages. Where applicable,
        selected batches are independently tested through Janoshik Analytical,
        with testing documentation available for relevant products. Request
        available batch documentation by emailing{" "}
        <a href="mailto:redlinelabsltd@pm.me" className="text-[#d4af37] underline underline-offset-2">
          redlinelabsltd@pm.me
        </a>{" "}
        with the product name and SKU.
      </>
    ),
  },
  {
    q: "How quickly are orders processed?",
    a: (
      <>
        The shipping policy states that orders are typically processed within
        1–3 business days after payment confirmation. Delivery dates are not
        guaranteed.
      </>
    ),
  },
  {
    q: "How can I contact Redline Labs?",
    a: (
      <>
        Email{" "}
        <a href="mailto:redlinelabsltd@pm.me" className="text-[#d4af37] underline underline-offset-2">
          redlinelabsltd@pm.me
        </a>{" "}
        or use the{" "}
        <Link href="/contact" className="text-[#d4af37] underline underline-offset-2">
          Contact
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "How do I view orders, COAs, and tracking?",
    a: (
      <>
        Create an account to open your profile. Full history lists every paid
        order, a COA request for each line, and the tracking number once the
        order is dispatched. Store credit applies automatically at checkout,
        saved addresses auto-fill, and stock alerts ping you when batches
        restock. Start at the{" "}
        <Link href="/account" className="text-[#d4af37] underline underline-offset-2">
          Account
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "Is there a checkout discount?",
    a: "Yes. 20% off the total order amount is applied automatically at checkout. Product prices stay as listed.",
  },
];
