import type { ReactNode } from "react";
import Link from "next/link";
import {
  COMPANY_EMAIL,
  COMPANY_NUMBER,
  INCORPORATION_DATE_LABEL,
  LEGAL_NAME,
  REGISTERED_COMPANY_SHORT,
} from "./company";

export type FaqItem = {
  q: string;
  text: string;
  a: ReactNode;
};

export const faqs: FaqItem[] = [
  {
    q: "What are these products for?",
    text: "They are sold for laboratory research only. They are not for human or veterinary consumption and are not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.",
    a: "They are sold for laboratory research only. They are not for human or veterinary consumption and are not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.",
  },
  {
    q: "Do you ship Australia-wide?",
    text: "This storefront lists Australia-wide dispatch. See the shipping policy for processing notes.",
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
    text: `COAs are not currently published on product pages. Where applicable, selected batches are independently tested through Janoshik Analytical, with testing documentation available for relevant products. Request available batch documentation by emailing ${COMPANY_EMAIL} with the product name and SKU.`,
    a: (
      <>
        COAs are not currently published on product pages. Where applicable,
        selected batches are independently tested through Janoshik Analytical,
        with testing documentation available for relevant products. Request
        available batch documentation by emailing{" "}
        <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37] underline underline-offset-2">
          {COMPANY_EMAIL}
        </a>{" "}
        with the product name and SKU.
      </>
    ),
  },
  {
    q: "How quickly are orders processed?",
    text: "The shipping policy states that orders are typically processed within 1–3 business days after payment confirmation. Delivery dates are not guaranteed.",
    a: (
      <>
        The shipping policy states that orders are typically processed within
        1–3 business days after payment confirmation. Delivery dates are not
        guaranteed.
      </>
    ),
  },
  {
    q: "Who operates Redline Labs?",
    text: `This storefront is operated by ${LEGAL_NAME} (Hong Kong company number ${COMPANY_NUMBER}), incorporated on ${INCORPORATION_DATE_LABEL}. ${REGISTERED_COMPANY_SHORT} See the About page for the registered-company notes.`,
    a: (
      <>
        This storefront is operated by {LEGAL_NAME} (Hong Kong company number{" "}
        {COMPANY_NUMBER}), incorporated on {INCORPORATION_DATE_LABEL}.{" "}
        {REGISTERED_COMPANY_SHORT} See the{" "}
        <Link href="/about" className="text-[#d4af37] underline underline-offset-2">
          About
        </Link>{" "}
        page for the registered-company notes.
      </>
    ),
  },
  {
    q: "How can I contact Redline Labs?",
    text: `Email ${COMPANY_EMAIL} or use the Contact page.`,
    a: (
      <>
        Email{" "}
        <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37] underline underline-offset-2">
          {COMPANY_EMAIL}
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
    text: "Create an account on this device to open your profile. History lists paid orders completed in this browser, with a COA request for each line. Saved addresses can auto-fill checkout. Stock alerts are a watchlist on this device and do not send email. Store credit shown on the account page is not deducted from the card charge. Start at the Account page.",
    a: (
      <>
        Create an account on this device to open your profile. History lists
        paid orders completed in this browser, with a COA request for each
        line. Saved addresses can auto-fill checkout. Stock alerts are a
        watchlist on this device and do not send email. Store credit shown on
        the account page is not deducted from the card charge. Start at the{" "}
        <Link href="/account" className="text-[#d4af37] underline underline-offset-2">
          Account
        </Link>{" "}
        page.
      </>
    ),
  },
  {
    q: "Is there a checkout discount?",
    text: "Orders of $200 or more include 10% off the catalogue total. A coupon on the cart or checkout page can take a further 20% off the remaining total. Product prices stay as listed, and the charged amount is calculated on the server.",
    a: "Orders of $200 or more include 10% off the catalogue total. A coupon on the cart or checkout page can take a further 20% off the remaining total. Product prices stay as listed, and the charged amount is calculated on the server.",
  },
];

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.text,
      },
    })),
  };
}
