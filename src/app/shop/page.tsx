"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
    <div className="wrap py-12">
      <p className="mb-6 text-[12px] tracking-[0.04em] text-[#8f8c84]">
        <Link href="/" className="hover:text-[#d4af37]">Home</Link>
        <span className="mx-2 text-white/20">/</span>
        Catalogue
      </p>
      <ResearchDisclaimer className="mb-10" />
      <div className="mb-10 flex flex-col justify-between gap-6 border-b border-[rgba(212,175,55,0.16)] pb-8 lg:flex-row lg:items-end">
        <div>
          <p className="kicker mb-3">Catalogue</p>
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">
            Research chemicals
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#8f8c84]">
            Laboratory research chemicals. Confirm identity against vial labels
            and any documentation you hold for the batch.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search catalogue"
          className="field max-w-xs"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`border px-3 py-1.5 text-[11px] font-medium tracking-[0.06em] uppercase ${
              category === cat
                ? "border-[#d4af37] bg-[#d4af37] text-black"
                : "border-white/12 text-[#cfc8b8] hover:border-[#d4af37] hover:text-[#d4af37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <p className="mb-8 text-[12px] text-[#8f8c84]">
        {filtered.length} listing{filtered.length === 1 ? "" : "s"}
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </div>
  );
}
