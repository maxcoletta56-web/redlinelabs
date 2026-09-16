import Link from "next/link";

export type Crumb = {
  href?: string;
  label: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-[12px] tracking-[0.04em] text-[#71717a]">
      <ol className="flex flex-wrap items-center">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center">
            {i > 0 && (
              <span className="mx-2 text-[#d4d4d8]" aria-hidden>
                /
              </span>
            )}
            {item.href ? (
              <Link href={item.href} className="hover:text-[#e11d2e]">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
