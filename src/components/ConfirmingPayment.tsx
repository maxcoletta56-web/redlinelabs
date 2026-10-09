"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The return URL is not proof of payment. Refresh until the webhook marks the order paid. */
export function ConfirmingPayment() {
  const router = useRouter();
  useEffect(() => {
    const tick = window.setInterval(() => router.refresh(), 3000);
    const stop = window.setTimeout(() => window.clearInterval(tick), 30_000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stop);
    };
  }, [router]);
  return null;
}
