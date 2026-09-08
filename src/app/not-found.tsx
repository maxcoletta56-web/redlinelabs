import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-24 text-center">
      <p className="kicker mb-3">404</p>
      <h1 className="font-serif mb-4 text-4xl font-medium">Page not found</h1>
      <Link href="/shop" className="text-[#d4af37]">
        Return to catalogue
      </Link>
    </div>
  );
}
