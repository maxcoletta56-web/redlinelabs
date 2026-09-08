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
    <header className="mb-12 max-w-2xl">
      <p className="kicker mb-3">{kicker}</p>
      <h1 className="font-serif text-4xl font-medium tracking-tight text-[#f4f1e8] sm:text-5xl">
        {title}
      </h1>
      {children && (
        <div className="mt-5 text-[15px] leading-8 text-[#a7a193]">{children}</div>
      )}
    </header>
  );
}
