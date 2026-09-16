"use client";

import { useState, type ReactNode } from "react";

export function FaqList({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const panelId = `faq-panel-${i}`;
        const buttonId = `faq-button-${i}`;
        const isOpen = open === i;
        return (
          <div key={item.q} className="overflow-hidden rounded-2xl border border-[#ececef] bg-white">
            <h2>
              <button
                id={buttonId}
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="text-[16px] font-medium text-[#0b0b0c]">{item.q}</span>
                <span className="text-[#71717a]" aria-hidden>
                  {isOpen ? "–" : "+"}
                </span>
              </button>
            </h2>
            {isOpen && (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="px-5 pb-5">
                <div className="mb-3 h-px w-10 bg-[#e11d2e]" />
                <p className="max-w-2xl text-sm leading-7 text-[#5c5c64]">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
