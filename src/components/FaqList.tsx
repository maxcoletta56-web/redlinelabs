"use client";

import { useState } from "react";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[rgba(212,175,55,0.15)] border-y border-[rgba(212,175,55,0.15)]">
      {items.map((item, i) => (
        <button
          key={item.q}
          className="w-full py-5 text-left"
          onClick={() => setOpen(open === i ? null : i)}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{item.q}</h2>
            <span className="text-[#d4af37]">{open === i ? "–" : "+"}</span>
          </div>
          {open === i && (
            <p className="mt-3 text-sm leading-7 text-[#c8c8c8]">{item.a}</p>
          )}
        </button>
      ))}
    </div>
  );
}
