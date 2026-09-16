import Link from "next/link";

export function BrandMark({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const color = tone === "light" ? "text-black" : "text-white";
  return (
    <Link
      href="/"
      className={`inline-flex items-baseline gap-1.5 font-black italic tracking-[-0.04em] ${color} ${className}`}
    >
      <span>
        Red<span className="text-[#e11d2e]">line</span>
      </span>
      <span className="not-italic text-[0.42em] font-semibold tracking-[0.22em]">LABS</span>
    </Link>
  );
}
