import { RESEARCH_DISCLAIMER } from "@/components/ResearchDisclaimer";

export function CoaSection({ sku }: { sku: string }) {
  return (
    <section className="mt-8 border-t border-white/10 pt-8">
      <h2 className="mb-3 text-xl font-bold">Certificate of Analysis</h2>
      <p className="text-[15px] leading-7 text-[#cfcfcf]">
        A batch-specific Certificate of Analysis is not published on this page.
        COA available on request: email{" "}
        <a href="mailto:redlinelabsltd@pm.me" className="text-[#d4af37] underline">
          redlinelabsltd@pm.me
        </a>
        {sku ? ` with SKU ${sku}` : ""} and the product name. Lot numbers are not
        currently displayed on this site.
      </p>
      <p className="mt-4 text-[15px] leading-7 text-[#cfcfcf]">{RESEARCH_DISCLAIMER}</p>
    </section>
  );
}
