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
    <div className="mx-auto max-w-[780px] px-5 py-16">
      <p className="kicker mb-3">{kicker}</p>
      <h1 className="font-serif mb-2 text-4xl font-medium tracking-tight">{title}</h1>
      <p className="mb-10 text-sm text-[#7d786c]">Last updated: {updated}</p>
      <div className="space-y-5 text-sm leading-8 text-[#cfc8b8] [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-[#f4f1e8]">
        {children}
      </div>
    </div>
  );
}
