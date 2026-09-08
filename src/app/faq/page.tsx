import type { Metadata } from "next";
import { FaqList } from "@/components/FaqList";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  {
    q: "What makes Redline Labs different?",
    a: "A focus on quality standards, considered packaging, and a straightforward customer experience.",
  },
  {
    q: "How quickly are orders processed?",
    a: "Most orders are processed promptly to keep fulfillment efficient.",
  },
  {
    q: "How are products packaged?",
    a: "Materials are packed to help maintain quality and arrive in good condition.",
  },
  {
    q: "Do you offer customer support?",
    a: "Yes. The team can assist with general inquiries and order-related questions.",
  },
  {
    q: "How can I contact Redline Labs?",
    a: "Use the Contact page. We respond as soon as possible during business hours.",
  },
  {
    q: "Are these products for human use?",
    a: "No. All materials are supplied strictly for laboratory research and are not intended for human or veterinary use.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-[860px] px-5 py-16">
      <PageIntro kicker="FAQ" title="Questions, answered.">
        Ordering, dispatch, packaging, and quality — the essentials.
      </PageIntro>
      <FaqList items={faqs} />
    </div>
  );
}
