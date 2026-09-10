import type { Metadata } from "next";
import Link from "next/link";
import { FaqList } from "@/components/FaqList";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";

export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  {
    q: "Are these products for human use?",
    a: "No. They are sold for laboratory research only. They are not for human or veterinary consumption and are not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.",
  },
  {
    q: "Do you publish Certificates of Analysis?",
    a: (
      <>
        COAs are not currently published on product pages. Request a COA by
        emailing{" "}
        <a
          href="mailto:redlinelabsltd@pm.me"
          className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
        >
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
        The{" "}
        <Link
          href="/shipping-policy"
          className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
        >
          shipping policy
        </Link>{" "}
        on this site states that orders are typically processed within 1–3
        business days after payment confirmation. Confirm current times with
        support if you need a specific commitment.
      </>
    ),
  },
  {
    q: "How can I contact Redline Labs?",
    a: (
      <>
        Email{" "}
        <a
          href="mailto:redlinelabsltd@pm.me"
          className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
        >
          redlinelabsltd@pm.me
        </a>{" "}
        or use the{" "}
        <Link
          href="/contact"
          className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
        >
          Contact
        </Link>{" "}
        page.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="wrap max-w-[860px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="FAQ" title="Frequently asked questions" crumb="FAQ">
        Research-use supply, documentation, and contact.
      </PageIntro>
      <FaqList items={faqs} />
    </div>
  );
}
