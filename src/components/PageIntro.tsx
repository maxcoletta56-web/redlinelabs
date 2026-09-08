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
      <h1 className="text-4xl font-extrabold tracking-tight text-white">{title}</h1>
      {children && <div className="mt-4 text-[16px] leading-7 text-[#9a9a9a]">{children}</div>}
    </header>
  );
}
