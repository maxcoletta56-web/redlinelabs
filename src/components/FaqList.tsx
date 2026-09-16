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
          <div key={item.q} className="overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.16)] bg-[#0b0b0b]">
            <h2>
              <button
                id={buttonId}
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="text-[16px] font-medium text-white">{item.q}</span>
                <span className="text-[#8f8c84]" aria-hidden>
                  {isOpen ? "–" : "+"}
                </span>
              </button>
            </h2>
            {isOpen && (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="px-5 pb-5">
                <div className="mb-3 h-px w-10 bg-[#d4af37]" />
                <p className="max-w-2xl text-sm leading-7 text-[#8f8c84]">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
