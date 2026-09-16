import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Placeholder } from "@/components/Placeholder";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";

export const metadata: Metadata = {
  title: "About",
  description:
    "Redline Labs lists laboratory research chemicals for purchase in Australia. Research use only. Not a pharmacy.",
};

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-[#ececef]">
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <ResearchDisclaimer className="mb-10" />
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
          <p className="kicker mb-3">About</p>
          <h1 className="mb-5 max-w-3xl text-[2.35rem] leading-[1.12] font-semibold tracking-[-0.03em] text-[#0b0b0c] sm:text-5xl">
            Laboratory research chemicals, listed for research use.
          </h1>
          <p className="max-w-2xl text-[16px] leading-8 text-[#5c5c64]">
            Redline Labs is an Australian catalogue of research chemicals for
            laboratory purchase. It is not a pharmacy and does not offer medical
            advice or treatment products.
          </p>
        </div>
      </section>

      <section className="border-b border-[#ececef]">
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <p className="kicker mb-3">Our story</p>
          <h2 className="section-title mb-6">How this catalogue started</h2>
          <div className="space-y-5 text-[15px] leading-8 text-[#5c5c64]">
            <p>
              Redline Labs began in <Placeholder name="FOUNDING YEAR" /> as a
              supplier of laboratory research chemicals within Australia.{" "}
              <Placeholder name="WHY STARTED" />
            </p>
            <p>
              <Placeholder name="FOUNDER BACKGROUND" />
            </p>
            <p>
              The catalogue on this site is for laboratory research only.
              Customers confirm research use at checkout. Product pages describe
              chemical identity and research-context pharmacology. They are not
              instructions for use in humans or animals.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#ececef] bg-white">
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <p className="kicker mb-3">Handling</p>
          <h2 className="section-title mb-4">How we handle product</h2>
          <p className="mb-8 max-w-2xl text-[15px] leading-7 text-[#5c5c64]">
            Storage and packing methods are not fully published here. The notes
            below separate what this site already states from fields still to
            be filled in.
          </p>
          <div className="grid gap-4">
            <article className="surface p-6">
              <h3 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-[#0b0b0c] uppercase">
                Cold-chain and storage
              </h3>
              <p className="text-[15px] leading-8 text-[#5c5c64]">
                Specific storage temperatures, hold times, and cold-chain
                practice are not described on this site. Replace with verified
                handling notes: <Placeholder name="STORAGE CONDITIONS" />{" "}
                <Placeholder name="COLD CHAIN" />
              </p>
            </article>
            <article className="surface p-6">
              <h3 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-[#0b0b0c] uppercase">
                Packaging
              </h3>
              <p className="text-[15px] leading-8 text-[#5c5c64]">
                Pack-out materials and vial presentation are not specified on
                this page. Replace with the packing method actually used:{" "}
                <Placeholder name="PACKAGING" />
              </p>
            </article>
            <article className="surface p-6">
              <h3 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-[#0b0b0c] uppercase">
                Dispatch timing
              </h3>
              <p className="text-[15px] leading-8 text-[#5c5c64]">
                The{" "}
                <Link
                  href="/shipping-policy"
                  className="text-[#e11d2e] underline decoration-[#e11d2e]/40 underline-offset-3"
                >
                  shipping policy
                </Link>{" "}
                states that orders are typically processed within 1–3 business
                days after payment confirmation, and that processing can take
                longer during high demand, holidays, or promotions. This
                storefront lists Australia-wide dispatch. Tracking may be sent
                once an order is processed, when the carrier provides it.
                Delivery dates are not guaranteed. This demonstration checkout
                does not offer shipping-method selection.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <p className="kicker mb-3">Documentation</p>
          <h2 className="section-title mb-4">Testing and documentation</h2>
          <div className="space-y-5 text-[15px] leading-8 text-[#5c5c64]">
            <p>
              A Certificate of Analysis (COA) is a batch document that reports
              analytical results for a specific lot — typically identity and
              related measurements. It is not a licence, a clinical approval, or
              a use instruction.
            </p>
            <p>
              Batch COAs are not published on product pages. Lot numbers are not
              currently displayed on this site. To request a COA for a batch,
              email{" "}
              <a
                href="mailto:redlinelabsltd@pm.me"
                className="text-[#e11d2e] underline decoration-[#e11d2e]/40 underline-offset-3"
              >
                redlinelabsltd@pm.me
              </a>{" "}
              with the product name and SKU (see the product page). The lab that
              issued the document, and the method used, are not named on this
              site: <Placeholder name="TEST METHOD" />{" "}
              <Placeholder name="COA PROVIDER" />
            </p>
          </div>

          <aside
            className="surface mt-8 border-dashed border-[#e11d2e]/45 p-6"
            role="note"
          >
            <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#e11d2e] uppercase">
              Placeholder — third-party testing
            </p>
            <p className="text-[15px] leading-8 text-[#5c5c64]">
              Third-party testing is not described on this site. Do not treat
              the copy above as a claim that an independent lab is named or
              that a method is published. Fill in whether testing exists and
              under what terms:{" "}
              <Placeholder name="THIRD PARTY TESTING STATUS" />
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
