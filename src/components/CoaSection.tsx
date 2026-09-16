import { RESEARCH_DISCLAIMER } from "@/components/ResearchDisclaimer";

export function CoaSection({ sku }: { sku: string }) {
  return (
    <section className="mt-8 border-t border-[rgba(212,175,55,0.16)] pt-8">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
        Certificate of Analysis
      </h2>
      <p className="text-[15px] leading-7 text-[#8f8c84]">
        A batch-specific Certificate of Analysis is not published on this page.
        COA available on request: email{" "}
        <a href="mailto:redlinelabsltd@pm.me" className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3">
          redlinelabsltd@pm.me
        </a>
        {sku ? ` with SKU ${sku}` : ""} and the product name. Lot numbers are not
        currently displayed on this site.
      </p>
      <p className="mt-4 text-[13px] leading-6 text-[#8f8c84]">{RESEARCH_DISCLAIMER}</p>
    </section>
  );
}
