import { RESEARCH_DISCLAIMER } from "@/components/ResearchDisclaimer";

export function CoaSection({ sku }: { sku: string }) {
  return (
    <section className="mt-8 border-t border-[#ececef] pt-8">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-[#0b0b0c] uppercase">
        Certificate of Analysis
      </h2>
      <p className="text-[15px] leading-7 text-[#5c5c64]">
        A batch-specific Certificate of Analysis is not published on this page.
        COA available on request: email{" "}
        <a href="mailto:redlinelabsltd@pm.me" className="text-[#e11d2e] underline decoration-[#e11d2e]/40 underline-offset-3">
          redlinelabsltd@pm.me
        </a>
        {sku ? ` with SKU ${sku}` : ""} and the product name. Lot numbers are not
        currently displayed on this site.
      </p>
      <p className="mt-4 text-[13px] leading-6 text-[#5c5c64]">{RESEARCH_DISCLAIMER}</p>
    </section>
  );
}
