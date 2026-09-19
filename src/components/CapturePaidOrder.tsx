"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "@/lib/account";
import { isAuState, type OrderLine, type OrderRecord } from "@/lib/account-data";
import { getProduct } from "@/lib/products";

type SessionPayload = {
  id?: string;
  payment_status?: string;
  status?: string;
  email?: string | null;
  amount_total?: number | null;
  amount_subtotal?: number | null;
  currency?: string | null;
  store_credit_cents?: number | null;
  line_items?: Array<{
    slug?: string | null;
    name?: string | null;
    option?: string | null;
    sku?: string | null;
    qty?: number | null;
    unit_amount?: number | null;
  }>;
  shipping?: {
    name?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    } | null;
  } | null;
};

function asOrder(session: SessionPayload): OrderRecord | null {
  if (!session.id || (session.payment_status !== "paid" && session.status !== "complete")) {
    return null;
  }
  const items: OrderLine[] = (session.line_items ?? [])
    .map((item) => {
      const slug = item.slug || "unknown";
      return {
        slug,
        name: item.name || "Research listing",
        option: item.option || null,
        variantLabel: getProduct(slug)?.variantLabel ?? null,
        sku: item.sku || "",
        qty: Number(item.qty) || 1,
        unitAmountCents: Number(item.unit_amount) || 0,
      };
    })
    .filter((item) => item.qty > 0);
  const address = session.shipping?.address;
  const names = (session.shipping?.name ?? "").trim().split(/\s+/);
  const state = address?.state?.trim() ?? "";
  return {
    id: `RL-${session.id.slice(-8).toUpperCase()}`,
    stripeSessionId: session.id,
    createdAt: new Date().toISOString(),
    email: (session.email ?? "").trim().toLowerCase(),
    status: "processing",
    items,
    subtotalCents: Number(session.amount_subtotal) || Number(session.amount_total) || 0,
    storeCreditCents: Number(session.store_credit_cents) || 0,
    totalCents: Number(session.amount_total) || 0,
    currency: (session.currency ?? "aud").toLowerCase(),
    trackingNumber: null,
    trackingUrl: null,
    shipping:
      address?.line1 && address.city && address.postal_code
        ? {
            label: "Checkout",
            firstName: names[0] || "Account",
            lastName: names.slice(1).join(" ") || "Holder",
            line1: address.line1,
            line2: address.line2 ?? "",
            city: address.city,
            state: isAuState(state) ? state : state || "NSW",
            postcode: address.postal_code,
            country: address.country || "AU",
            phone: session.shipping?.phone ?? "",
          }
        : null,
  };
}

export function CapturePaidOrder({ sessionId }: { sessionId?: string }) {
  const { captureOrder } = useAccount();
  const captured = useRef(false);

  useEffect(() => {
    if (!sessionId || captured.current) return;
    let cancelled = false;
    fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionPayload | null) => {
        if (cancelled || !data) return;
        const order = asOrder(data);
        if (!order) return;
        captured.current = true;
        captureOrder(order);
      })
      .catch(() => {
        /* keep the success page usable if history capture fails */
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, captureOrder]);

  return null;
}
