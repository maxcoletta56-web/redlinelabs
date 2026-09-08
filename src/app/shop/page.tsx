"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { categories, products } from "@/lib/products";

export default function ShopPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q));
      const matchesCat = category === "All" || p.categories.includes(category);
      return matchesQuery && matchesCat;
    });
  }, [query, category]);

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-12">
      <p className="mb-6 text-sm text-[#9a9a9a]">Home / Shop</p>
      <ResearchDisclaimer className="mb-8" />
      <div className="mb-8 text-center">
        <h1 className="mb-3 text-4xl font-extrabold">Shop</h1>
        <p className="text-[#9a9a9a]">
          Laboratory research chemicals. Confirm identity against vial labels
          and any documentation you hold for the batch.
        </p>
      </div>

      <div className="mb-6 flex justify-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="field max-w-sm"
        />
      </div>

      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`pill border px-4 py-2 text-[13px] font-medium ${
              category === cat
                ? "border-[#d4af37] bg-[#d4af37] text-black"
                : "border-white/15 text-[#d0d0d0] hover:border-[#d4af37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
