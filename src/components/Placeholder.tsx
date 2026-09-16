export function Placeholder({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`mx-0.5 inline border border-dashed border-[#e11d2e]/70 bg-[#e11d2e]/10 px-1.5 py-0.5 font-mono text-[12px] leading-none font-medium tracking-wide text-[#e11d2e] ${className}`}
      title="Replace this placeholder with verified copy"
    >
      {`[[${name}]]`}
    </span>
  );
}
