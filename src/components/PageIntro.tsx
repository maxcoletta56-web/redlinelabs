export function PageIntro({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-10 max-w-2xl">
      <p className="kicker mb-3">{kicker}</p>
      <h1 className="text-[2.15rem] leading-tight font-semibold tracking-[-0.03em] text-white">
        {title}
      </h1>
      {children && <div className="mt-4 text-[15px] leading-7 text-[#8f8c84]">{children}</div>}
    </header>
  );
}
