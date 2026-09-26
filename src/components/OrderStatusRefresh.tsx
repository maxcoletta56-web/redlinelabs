"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OrderStatusRefresh({ orderId }: { orderId: string }) {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts > 20) {
        window.clearInterval(timer);
        return;
      }
      router.refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [orderId, router]);

  return (
    <p className="mb-4 text-sm leading-7 text-[#8f8c84]" role="status">
      Waiting for Whop to confirm this payment. A 3D Secure challenge or other
      bank step has to finish before the order is marked paid.
    </p>
  );
}
