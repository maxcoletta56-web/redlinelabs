import type { ReactNode } from "react";

export function PolicyLayout({
  kicker,
  title,
  updated,
  children,
}: {
  kicker: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[860px] px-5 py-16">
      <p className="mb-3 text-xs tracking-[0.28em] text-[#d4af37] uppercase">{kicker}</p>
      <h1 className="mb-2 text-4xl font-bold">{title}</h1>
      <p className="mb-10 text-sm text-[#9a9a9a]">Last updated: {updated}</p>
      <div className="space-y-6 text-sm leading-8 text-[#cfcfcf] [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white">
        {children}
      </div>
    </div>
  );
}
