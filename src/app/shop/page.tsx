"use client";

import { useMemo, useState } from "react";
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
    <div className="mx-auto max-w-[1280px] px-5 py-14">
      <p className="mb-2 text-[11px] tracking-[0.24em] text-[#d4af37] uppercase">
        Catalogue
      </p>
      <h1 className="mb-3 text-4xl font-semibold tracking-tight">Shop</h1>
      <p className="mb-10 max-w-2xl text-sm leading-7 text-[#b8b8b8]">
        Thirty research compounds, supplied for laboratory use. Filter by
        category or search by name.
      </p>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the catalogue"
          className="w-full max-w-sm border border-[rgba(212,175,55,0.22)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#b8b8b8]">
          <p>
            {filtered.length} of {products.length} products
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="border border-[rgba(212,175,55,0.22)] bg-black px-3 py-2 text-sm"
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
                : "border-[rgba(212,175,55,0.18)] text-[#d0d0d0] hover:border-[#d4af37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
