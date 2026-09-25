"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
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
    <div className="wrap max-w-[700px] py-24 text-center">
      <p className="kicker mb-3">Error</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        Something went wrong
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        The page could not be loaded. Try again, or return to the catalogue.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/shop" className="btn-ghost">
          Shop
        </Link>
        <Link href="/" className="btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
