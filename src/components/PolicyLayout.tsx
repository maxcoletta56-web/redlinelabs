import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

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
    <div className="wrap max-w-[780px] py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />
      <p className="kicker mb-3">{kicker}</p>
      <h1 className="mb-2 text-[2.15rem] font-semibold tracking-[-0.03em] text-[#0b0b0c]">{title}</h1>
      <p className="mb-10 text-sm text-[#5c5c64]">Last updated: {updated}</p>
      <div className="space-y-5 text-sm leading-8 text-[#3f3f46] [&_h2]:mt-8 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:tracking-[0.12em] [&_h2]:text-[#0b0b0c] [&_h2]:uppercase">
        {children}
      </div>
    </div>
  );
}
