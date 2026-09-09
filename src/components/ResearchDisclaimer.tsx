export const RESEARCH_DISCLAIMER =
  "For laboratory research use only. Not for human or veterinary consumption. Not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.";

export function ResearchDisclaimer({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`border-l-2 border-[#d4af37] bg-[#d4af37]/6 px-4 py-3 text-[13px] leading-6 text-[#cfc8b8] ${className}`}
      role="note"
    >
      {RESEARCH_DISCLAIMER}
    </aside>
  );
}
