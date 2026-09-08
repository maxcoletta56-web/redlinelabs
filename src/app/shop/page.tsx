"use client";

import { useMemo, useState } from "react";
import { PageIntro } from "@/components/PageIntro";
import { ProductCard } from "@/components/ProductCard";
import { categories, products } from "@/lib/products";

const sorts = [
  { id: "featured", label: "Featured" },
  { id: "az", label: "Name A–Z" },
  { id: "low", label: "Price: low to high" },
  { id: "high", label: "Price: high to low" },
] as const;

export default function ShopPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState<(typeof sorts)[number]["id"]>("featured");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q));
      const matchesCat = category === "All" || p.categories.includes(category);
      return matchesQuery && matchesCat;
    });
    if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "low") list = [...list].sort((a, b) => a.minPrice - b.minPrice);
    if (sort === "high") list = [...list].sort((a, b) => b.minPrice - a.minPrice);
    return list;
  }, [query, category, sort]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-14">
      <PageIntro kicker="Catalogue" title="Research materials">
        Thirty compounds, supplied for laboratory use. Filter by category or
        search by name.
      </PageIntro>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the catalogue"
          className="field max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#a7a193]">
          <p>
            {filtered.length} of {products.length}
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="field w-auto"
          >
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`border px-3.5 py-2 text-[11px] font-medium tracking-[0.12em] uppercase ${
              category === cat
                ? "border-[#d4af37] bg-[#d4af37] text-black"
                : "border-[rgba(212,175,55,0.18)] text-[#d5d0c4] hover:border-[#d4af37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
