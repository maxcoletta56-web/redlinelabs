import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "That address is not in the Redline Labs storefront. Browse the research catalogue or return to the homepage.",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <div className="wrap max-w-[700px] py-24 text-center">
      <p className="kicker mb-3">404</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Page not found</h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        That address is not in this storefront. The catalogue and policy pages
        are linked below.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/shop" className="btn">
          Shop
        </Link>
        <Link href="/" className="btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
