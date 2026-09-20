"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { usePromo } from "@/lib/promo-state";

export function ClearCartOnSuccess() {
  const { clear } = useCart();
  const { clearCode } = usePromo();

  useEffect(() => {
    clear();
    clearCode();
  }, [clear, clearCode]);

  return null;
}
