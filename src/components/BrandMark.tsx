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
    <Link href="/" className={`font-black italic tracking-[-0.04em] ${color} ${className}`}>
      Red<span className="text-[#e11d2e]">line</span>
    </Link>
  );
}
