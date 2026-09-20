"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { AUTO_PROMO, type CheckoutPromo } from "@/lib/promo";

type PromoContextValue = {
  promo: CheckoutPromo;
};

const PromoContext = createContext<PromoContextValue | null>(null);

export function PromoProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ promo: AUTO_PROMO }), []);
  return <PromoContext.Provider value={value}>{children}</PromoContext.Provider>;
}

export function usePromo() {
  const ctx = useContext(PromoContext);
  if (!ctx) throw new Error("usePromo must be used within PromoProvider");
  return ctx;
}
