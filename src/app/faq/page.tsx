import type { Metadata } from "next";
import { FaqList } from "@/components/FaqList";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { faqs } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers on research-use supply, certificates of analysis, dispatch, and how to contact Redline Labs.",
};

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
