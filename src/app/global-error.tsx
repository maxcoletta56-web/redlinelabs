"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en-AU">
      <body className="flex min-h-full flex-col bg-[#050505] text-[#f3f1ea]">
        <div className="mx-auto max-w-[700px] px-5 py-24 text-center">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-[#d4af37] uppercase">
            Error
          </p>
          <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
            Something went wrong
          </h1>
          <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
            The storefront hit an unexpected error. Try again, or go back to the
            home page.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center bg-[#d4af37] px-5 py-3 text-[12px] font-semibold tracking-[0.08em] text-black uppercase"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.assign("/");
              }}
              className="inline-flex items-center justify-center border border-[rgba(212,175,55,0.34)] px-5 py-3 text-[12px] font-semibold tracking-[0.08em] uppercase"
            >
              Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
