"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CheckoutPromo } from "@/lib/promo";

type PromoContextValue = {
  promo: CheckoutPromo | null;
  pending: boolean;
  error: string | null;
  applyCode: (input: string) => Promise<CheckoutPromo | null>;
  clearCode: () => void;
  clearError: () => void;
};

const PromoContext = createContext<PromoContextValue | null>(null);
const LEGACY_STORAGE_KEYS = ["redline-promo-v1", "redline-promo-v2"];

let hydrated = false;
let appliedPromo: CheckoutPromo | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function forgetStoredCodes() {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function persist(promo: CheckoutPromo | null) {
  appliedPromo = promo;
  forgetStoredCodes();
  emit();
}

export function hydratePromo() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  forgetStoredCodes();
  appliedPromo = null;
  emit();
}

function getSnapshot() {
  return hydrated ? appliedPromo : null;
}

function readPromo(value: unknown): CheckoutPromo | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.code !== "string" || record.code.length === 0) return null;
  if (typeof record.percentOff !== "number" || !Number.isFinite(record.percentOff)) return null;
  if (typeof record.name !== "string" || record.name.length === 0) return null;
  return {
    code: record.code,
    percentOff: record.percentOff,
    name: record.name,
  };
}

export function PromoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    hydratePromo();
  }, []);

  const promo = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const applyCode = useCallback(async (input: string) => {
    hydratePromo();
    const id = ++requestId.current;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: input }),
      });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (id !== requestId.current) return null;
      const next = response.ok ? readPromo(body) : null;
      if (!next) {
        setError("Invalid code");
        return null;
      }
      persist(next);
      return next;
    } catch {
      if (id !== requestId.current) return null;
      setError("Invalid code");
      return null;
    } finally {
      if (id === requestId.current) setPending(false);
    }
  }, []);

  const clearCode = useCallback(() => {
    hydratePromo();
    requestId.current += 1;
    setPending(false);
    setError(null);
    persist(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ promo, pending, error, applyCode, clearCode, clearError }),
    [promo, pending, error, applyCode, clearCode, clearError],
  );

  return <PromoContext.Provider value={value}>{children}</PromoContext.Provider>;
}

export function usePromo() {
  const ctx = useContext(PromoContext);
  if (!ctx) throw new Error("usePromo must be used within PromoProvider");
  return ctx;
}
