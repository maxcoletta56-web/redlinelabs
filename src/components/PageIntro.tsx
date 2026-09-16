import { Breadcrumbs } from "@/components/Breadcrumbs";

export function PageIntro({
  kicker,
  title,
  crumb,
  children,
}: {
  kicker: string;
  title: string;
  crumb?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10 max-w-2xl">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: crumb ?? title }]} />
      <p className="kicker mb-3">{kicker}</p>
      <h1 className="text-[2.15rem] leading-tight font-semibold tracking-[-0.03em] text-[#0b0b0c]">
        {title}
      </h1>
      {children && <div className="mt-4 text-[15px] leading-7 text-[#5c5c64]">{children}</div>}
    </header>
  );
}
