export function Placeholder({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`mx-0.5 inline border border-dashed border-[#d4af37]/70 bg-[#d4af37]/10 px-1.5 py-0.5 font-mono text-[12px] leading-none font-medium tracking-wide text-[#d4af37] ${className}`}
      title="Replace this placeholder with verified copy"
    >
      {`[[${name}]]`}
    </span>
  );
}
