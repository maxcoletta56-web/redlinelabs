"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { lookupPromo, type CheckoutPromo } from "@/lib/promo";

type PromoContextValue = {
  promo: CheckoutPromo | null;
  applyCode: (input: string) => CheckoutPromo | null;
  clearCode: () => void;
};

const PromoContext = createContext<PromoContextValue | null>(null);
const STORAGE_KEY = "redline-promo-v1";

let hydrated = false;
let appliedCode: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function persist(code: string | null) {
  appliedCode = code;
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

function promoFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return lookupPromo(params.get("code") || params.get("promo"));
}

export function hydratePromo() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let stored: CheckoutPromo | null = null;
  try {
    stored = lookupPromo(sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY));
  } catch {
    stored = null;
  }
  appliedCode = promoFromUrl()?.code ?? stored?.code ?? null;
  if (appliedCode) {
    try {
      localStorage.setItem(STORAGE_KEY, appliedCode);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  emit();
}

function getSnapshot() {
  return hydrated ? appliedCode : null;
}

export function PromoProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydratePromo();
  }, []);

  const code = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const promo = lookupPromo(code);

  const applyCode = useCallback((input: string) => {
    hydratePromo();
    const next = lookupPromo(input);
    if (!next) return null;
    persist(next.code);
    return next;
  }, []);

  const clearCode = useCallback(() => {
    hydratePromo();
    persist(null);
  }, []);

  const value = useMemo(
    () => ({ promo, applyCode, clearCode }),
    [promo, applyCode, clearCode],
  );

  return <PromoContext.Provider value={value}>{children}</PromoContext.Provider>;
}

export function usePromo() {
  const ctx = useContext(PromoContext);
  if (!ctx) throw new Error("usePromo must be used within PromoProvider");
  return ctx;
}
