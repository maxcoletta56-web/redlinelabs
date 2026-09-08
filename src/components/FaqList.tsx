"use client";

import { useState } from "react";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="border-y border-[rgba(212,175,55,0.14)]">
      {items.map((item, i) => (
        <button
          key={item.q}
          className="w-full border-b border-[rgba(212,175,55,0.14)] py-5 text-left last:border-b-0"
          onClick={() => setOpen(open === i ? null : i)}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-2xl font-medium">{item.q}</h2>
            <span className="text-[#d4af37]">{open === i ? "–" : "+"}</span>
          </div>
          {open === i && (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#a7a193]">{item.a}</p>
          )}
        </button>
      ))}
    </div>
  );
}
