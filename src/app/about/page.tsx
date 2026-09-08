import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";

export const metadata: Metadata = { title: "About Us" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[860px] px-5 py-14">
      <ResearchDisclaimer className="mb-8" />
      <PageIntro kicker="About" title="Redline Labs">
        This site lists laboratory research chemicals for purchase by customers
        who confirm research use at checkout. It is not a pharmacy and does not
        offer medical advice or treatment products.
      </PageIntro>
      <div className="space-y-5 text-[16px] leading-8 text-[#cfcfcf]">
        <p>
          Contact:{" "}
          <a href="mailto:redlinelabsltd@pm.me" className="text-[#d4af37] underline">
            redlinelabsltd@pm.me
          </a>
          . Dispatch is described on the Shipping Policy page. Certificates of
          Analysis are available on request; they are not published per product
          on this site yet.
        </p>
        <p>
          Product pages describe chemical identity and research-context
          pharmacology only. They are not instructions for use in humans or
          animals.
        </p>
      </div>
    </div>
  );
}
