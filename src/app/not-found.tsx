import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-24 text-center">
      <p className="mb-3 text-xs tracking-[0.24em] text-[#d4af37] uppercase">404</p>
      <h1 className="mb-4 text-3xl font-bold">Page not found</h1>
      <Link href="/shop" className="text-[#d4af37] underline">
        Return to shop
      </Link>
    </div>
  );
}
