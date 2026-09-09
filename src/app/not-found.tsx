import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap max-w-[700px] py-24 text-center">
      <p className="kicker mb-3">404</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Page not found</h1>
      <Link href="/shop" className="text-[#d4af37]">
        Return to catalogue
      </Link>
    </div>
  );
}
