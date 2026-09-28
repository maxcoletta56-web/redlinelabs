import { RESEARCH_DISCLAIMER } from "@/lib/company";

export { RESEARCH_DISCLAIMER };

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
