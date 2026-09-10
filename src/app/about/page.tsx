import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="wrap max-w-[860px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="About" title="Redline Labs" crumb="About">
        This site lists laboratory research chemicals for purchase by customers
        who confirm research use at checkout. It is not a pharmacy and does not
        offer medical advice or treatment products.
      </PageIntro>
      <div className="space-y-5 text-[15px] leading-8 text-[#cfc8b8]">
        <p>
          Contact:{" "}
          <a href="mailto:redlinelabsltd@pm.me" className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3">
            redlinelabsltd@pm.me
          </a>
          . Dispatch is described on the{" "}
          <Link
            href="/shipping-policy"
            className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
          >
            Shipping Policy
          </Link>{" "}
          page. Certificates of Analysis are available on request; they are not
          published per product on this site yet.
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
