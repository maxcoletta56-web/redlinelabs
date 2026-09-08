export const RESEARCH_DISCLAIMER =
  "For laboratory research use only. Not for human or veterinary consumption. Not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.";

export function ResearchDisclaimer({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`border border-[#d4af37] bg-[#d4af37]/10 px-5 py-4 text-[15px] leading-7 text-[#f4f1e8] ${className}`}
      role="note"
    >
      {RESEARCH_DISCLAIMER}
    </aside>
  );
}
