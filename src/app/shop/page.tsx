"use client";

import { useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field, SelectField } from "@/components/Field";
import { ProductCard } from "@/components/ProductCard";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { catalogItems, categories, listingPrice } from "@/lib/products";

const sorts = [
  { value: "catalogue", label: "Catalogue order" },
  { value: "name", label: "Name A–Z" },
  { value: "price-asc", label: "Price low to high" },
  { value: "price-desc", label: "Price high to low" },
] as const;

type Sort = (typeof sorts)[number]["value"];

export default function ShopPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState<Sort>("catalogue");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = catalogItems().filter((item) => {
      const { product, variant } = item;
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q) ||
        (variant?.sku ?? "").toLowerCase().includes(q) ||
        (variant?.option ?? "").toLowerCase().includes(q) ||
        `${variant?.option ?? ""}${product.variantLabel ?? ""}`.toLowerCase().includes(q) ||
        product.categories.some((c) => c.toLowerCase().includes(q));
      const matchesCat = category === "All" || product.categories.includes(category);
      return matchesQuery && matchesCat;
    });

    return [...list].sort((a, b) => {
      if (sort === "name") {
        return a.product.name.localeCompare(b.product.name) || listingPrice(a) - listingPrice(b);
      }
      if (sort === "price-asc") return listingPrice(a) - listingPrice(b);
      if (sort === "price-desc") return listingPrice(b) - listingPrice(a);
      return 0;
    });
  }, [query, category, sort]);

  return (
    <div className="wrap py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Catalogue" }]} />
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
        <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <Field
            id="catalogue-search"
            label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, SKU, or category"
            className="field"
          />
          <SelectField
            id="catalogue-sort"
            label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            {sorts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
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
      <p className="mb-8 text-[12px] text-[#8f8c84]" aria-live="polite">
        {filtered.length} listing{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="mb-3 text-sm text-[#8f8c84]">
            No listings match this search or category.
          </p>
          <button
            type="button"
            className="text-[#d4af37]"
            onClick={() => {
              setQuery("");
              setCategory("All");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((item) => (
            <ProductCard key={item.listingKey} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
