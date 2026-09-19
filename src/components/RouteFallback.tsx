export function RouteFallback({ label }: { label: string }) {
  return (
    <div className="wrap py-16">
      <p className="kicker mb-3">{label}</p>
      <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">
        {label}
      </h1>
      <p className="mt-4 text-sm text-[#8f8c84]">Loading…</p>
    </div>
  );
}
