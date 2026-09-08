"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { categories, products } from "@/lib/products";

const sorts = [
  { id: "featured", label: "Sort by popularity" },
  { id: "az", label: "Sort by name" },
  { id: "low", label: "Sort by price: low to high" },
  { id: "high", label: "Sort by price: high to low" },
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
      const matchesCat =
        category === "All" || p.categories.includes(category);
      return matchesQuery && matchesCat;
    });
    if (sort === "az") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "low") list = [...list].sort((a, b) => a.minPrice - b.minPrice);
    if (sort === "high") list = [...list].sort((a, b) => b.minPrice - a.minPrice);
    return list;
  }, [query, category, sort]);

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12">
      <p className="mb-2 text-xs tracking-[0.28em] text-[#d4af37] uppercase">Catalogue</p>
      <h1 className="mb-8 text-4xl font-bold">Shop</h1>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          className="w-full max-w-sm rounded-sm border border-[rgba(212,175,55,0.25)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[#b8b8b8]">
            Showing {filtered.length} of {products.length} results
          </p>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-sm border border-[rgba(212,175,55,0.25)] bg-black px-3 py-2 text-sm"
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
            className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-wide uppercase ${
              category === cat
                ? "border-[#d4af37] bg-[#d4af37] text-black"
                : "border-[rgba(212,175,55,0.2)] text-[#d0d0d0] hover:border-[#d4af37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
