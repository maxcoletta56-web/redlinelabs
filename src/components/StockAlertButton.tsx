"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/lib/account";
import { hasStockAlert } from "@/lib/account-data";

export function StockAlertButton({
  slug,
  name,
  sku,
}: {
  slug: string;
  name: string;
  sku: string;
}) {
  const pathname = usePathname();
  const { user, hydrated, watchProduct, unwatchProduct } = useAccount();
  const watching = user ? hasStockAlert(user, slug) : false;
  const next = `/account?next=${encodeURIComponent(pathname || `/product/${slug}`)}`;

  if (!hydrated) {
    return (
      <p className="text-sm text-[#8f8c84]">Checking stock alerts…</p>
    );
  }

  if (!user) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]">
        <Link href={next} className="text-[#d4af37]">
          Sign in
        </Link>{" "}
        to get pinged when this batch restocks.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {watching ? (
        <>
          <p className="text-sm leading-6 text-[#8f8c84]">
            Watching {name}. We will ping {user.email} when a new batch is listed.
          </p>
          <button type="button" className="btn-ghost" onClick={() => unwatchProduct(slug)}>
            Stop alert
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn-outline"
          onClick={() => watchProduct({ slug, name, sku })}
        >
          Notify me of restocks
        </button>
      )}
    </div>
  );
}
