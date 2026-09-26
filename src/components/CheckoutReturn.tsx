"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CapturePaidOrder } from "@/components/CapturePaidOrder";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { formatPrice } from "@/lib/products";

type OrderPayload = {
  id?: string;
  status?: string;
  amount_total?: number;
};

export function CheckoutReturn() {
  const params = useSearchParams();
  const status = params.get("status");
  const orderId = params.get("orderId");
  const [order, setOrder] = useState<OrderPayload | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/orders/${encodeURIComponent(orderId)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data: OrderPayload | null) => {
          if (!cancelled && data) setOrder(data);
        })
        .catch(() => {
          /* the return page still explains the redirect */
        });
    };
    load();
    const timer = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId]);

  if (status === "error") {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Card payment not finished</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The bank declined the card, or the 3D Secure step was cancelled. Start the card form
          again. The order stays unpaid until Whop confirms it.
        </p>
        <Link href="/checkout" className="btn">
          Try the card again
        </Link>
      </div>
    );
  }

  const paid = order?.status === "paid";
  const total = typeof order?.amount_total === "number" ? formatPrice(order.amount_total / 100) : null;

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      {paid && <ClearCartOnSuccess />}
      {paid && orderId && <CapturePaidOrder sessionId={orderId} href={`/api/orders/${orderId}`} />}
      <p className="kicker mb-3">{paid ? "Paid" : "Checkout"}</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {paid ? "Thank you" : "Payment submitted"}
      </h1>
      <p className="mb-4 text-sm leading-7 text-[#8f8c84]">
        {paid
          ? "Whop confirmed this card payment. A confirmation email is sent to the address used at checkout."
          : "If your bank asked you to verify the card, that step is finished when you land here. The order is marked paid when the Whop webhook arrives, and the confirmation email follows that."}
      </p>
      {total && <p className="mb-8 text-[15px] text-[#d4af37]">Amount {total} AUD</p>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/account" className="btn">
          View account
        </Link>
        <Link href="/shop" className="btn-ghost">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
