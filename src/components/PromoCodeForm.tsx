"use client";

import { useState } from "react";
import { usePromo } from "@/lib/promo-state";

export function PromoCodeForm({ id = "checkout-code" }: { id?: string }) {
  const { promo, applyCode, clearCode } = usePromo();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (promo) {
    return (
      <div className="mb-4 border-t border-[rgba(212,175,55,0.16)] pt-4">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Checkout code
        </p>
        <p className="mt-2 text-sm text-[#d4af37]">
          {promo.code} · {promo.name}
        </p>
        <button
          type="button"
          onClick={clearCode}
          className="mt-1 text-xs text-[#8f8c84] hover:text-[#d4af37]"
        >
          Remove code
        </button>
      </div>
    );
  }

  return (
    <form
      className="mb-4 border-t border-[rgba(212,175,55,0.16)] pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const next = applyCode(value);
        if (!next) {
          setError("That checkout code is not valid");
          return;
        }
        setError(null);
        setValue("");
      }}
    >
      <label
        htmlFor={id}
        className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase"
      >
        Checkout code
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="checkoutCode"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Enter code"
          className="field py-2"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="submit" className="btn-ghost shrink-0 self-stretch px-4">
          Apply
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
