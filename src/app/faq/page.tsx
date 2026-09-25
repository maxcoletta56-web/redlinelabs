import type { Metadata } from "next";
import { FaqList } from "@/components/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { faqs, faqJsonLd } from "@/lib/faqs";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FAQ",
  description:
    "Answers on research-use supply, certificates of analysis, Australia-wide dispatch, who operates Redline Labs, and how to contact the catalogue team.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <div className="wrap max-w-[860px] py-16">
      <JsonLd data={faqJsonLd()} />
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="FAQ" title="Frequently asked questions" crumb="FAQ">
        Research-use supply, documentation, and contact.
      </PageIntro>
      <FaqList items={faqs} />
    </div>
  );
}
