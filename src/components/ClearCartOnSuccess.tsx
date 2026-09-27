"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { cartClearedStorageKey, shouldClearCart } from "@/lib/cart-clear";
import { usePromo } from "@/lib/promo-state";

export function ClearCartOnSuccess({ onceKey }: { onceKey?: string }) {
  const { clear } = useCart();
  const { clearCode } = usePromo();

  useEffect(() => {
    let alreadyCleared = false;
    if (onceKey) {
      try {
        alreadyCleared = localStorage.getItem(cartClearedStorageKey(onceKey)) === "1";
      } catch {
        alreadyCleared = false;
      }
    }
    if (!shouldClearCart(onceKey, alreadyCleared)) return;
    clear();
    clearCode();
    if (!onceKey) return;
    try {
      localStorage.setItem(cartClearedStorageKey(onceKey), "1");
    } catch {
      // Storage can be blocked. This visit still cleared the cart.
    }
  }, [clear, clearCode, onceKey]);

  return null;
}
