import type { Metadata } from "next";
import { FaqList } from "@/components/FaqList";

export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  {
    q: "What makes Redline Labs different?",
    a: "Redline Labs is committed to premium quality standards, professional service, secure packaging, and a seamless customer experience.",
  },
  {
    q: "How quickly are orders processed?",
    a: "Most orders are processed promptly to ensure efficient fulfillment and delivery.",
  },
  {
    q: "How are products packaged?",
    a: "Products are securely packaged to help maintain quality and ensure safe delivery.",
  },
  {
    q: "Do you offer customer support?",
    a: "Yes. Our team is available to assist with general inquiries and order-related questions.",
  },
  {
    q: "How can I contact Redline Labs?",
    a: "You can reach out through our Contact page and our team will respond as soon as possible.",
  },
  {
    q: "Are these products for human use?",
    a: "No. All materials are supplied strictly for laboratory research. They are not intended for human or veterinary use.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16">
      <p className="mb-3 text-xs tracking-[0.28em] text-[#d4af37] uppercase">
        Frequently asked questions
      </p>
      <h1 className="mb-4 text-4xl font-bold">Everything You Need To Know</h1>
      <p className="mb-10 text-base leading-8 text-[#cfcfcf]">
        Find answers to common questions about our products, ordering process,
        shipping, and quality standards.
      </p>
      <FaqList items={faqs} />
    </div>
  );
}
