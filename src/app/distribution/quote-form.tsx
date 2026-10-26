"use client";

import { useActionState, useState } from "react";
import { TextAreaField } from "@/components/Field";
import { boxFieldName } from "@/lib/distribution-fields";
import { requestDistributionQuote, type DistributionFormState } from "./actions";

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

const initialState: DistributionFormState = { error: null };

export type QuoteOffer = {
  slug: string;
  name: string;
  sku: string;
  optionLabel: string;
  boxCents: number;
  unitsPerBox: number;
};

export function QuoteForm({ offers, minBoxes }: { offers: QuoteOffer[]; minBoxes: number }) {
  const [state, action, pending] = useActionState(requestDistributionQuote, initialState);
  const [query, setQuery] = useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const groups: Array<{ slug: string; name: string; offers: QuoteOffer[] }> = [];
  for (const offer of offers) {
    const current = groups[groups.length - 1];
    if (current && current.slug === offer.slug) current.offers.push(offer);
    else groups.push({ slug: offer.slug, name: offer.name, offers: [offer] });
  }

  function matches(offer: QuoteOffer) {
    if (terms.length === 0) return true;
    const haystack = `${offer.name} ${offer.sku} ${offer.optionLabel}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor="dist-quote-search" className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Find a listing
        </label>
        <input
          id="dist-quote-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="field"
          type="search"
          placeholder="Name or SKU"
        />
        <p className="mt-3 text-sm leading-6 text-[#8f8c84]">
          Each box is {offers[0]?.unitsPerBox ?? 10} units. The price shown is the distributor price for one box. Each
          product needs at least {minBoxes} boxes. Empty rows are left off the quote.
        </p>
      </div>
      {groups.map((group) => {
        const shown = group.offers.some(matches);
        return (
          <section key={group.slug} className={shown ? "surface p-4 sm:p-5" : "hidden"}>
            <h3 className="text-[15px] font-semibold text-white">{group.name}</h3>
            <div className="mt-3">
              {group.offers.map((offer) => (
                <div
                  key={offer.sku}
                  className={`grid gap-3 border-t border-[rgba(212,175,55,0.16)] py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7.5rem] sm:items-center ${
                    matches(offer) ? "" : "hidden"
                  }`}
                >
                  <div>
                    <p className="text-sm text-white">{offer.optionLabel}</p>
                    <p className="text-[12px] text-[#8f8c84]">SKU {offer.sku}</p>
                  </div>
                  <p className="text-sm text-white">
                    {offer.boxCents > 0 ? `Box ${money(offer.boxCents)}` : "Box price on request"}
                  </p>
                  <label className="block">
                    <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                      Boxes
                    </span>
                    <input
                      name={boxFieldName(offer.sku)}
                      type="number"
                      min={minBoxes}
                      max={50}
                      step={1}
                      inputMode="numeric"
                      placeholder={String(minBoxes)}
                      aria-label={`Boxes of ${offer.name} ${offer.optionLabel}`}
                      className="field w-full"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <TextAreaField id="dist-quote-note" name="note" label="Note for this quote (optional)" rows={3} maxLength={500} />
      {state.error ? (
        <p role="alert" className="text-sm leading-6 text-[#d4af37]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn min-h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? "Saving quote" : "Request quote"}
      </button>
    </form>
  );
}
