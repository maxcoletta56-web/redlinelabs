"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { getProduct } from "./products";

export const MAX_QTY = 99;

export function clampQty(qty: number) {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(MAX_QTY, Math.max(1, Math.floor(qty)));
}

export type CartItem = {
  slug: string;
  name: string;
  image: string;
  option: string | null;
  variantLabel: string | null;
  price: number;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  updateQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "redline-cart-v1";
const empty: CartItem[] = [];

export function itemKey(item: Pick<CartItem, "slug" | "option">) {
  return `${item.slug}::${item.option ?? "default"}`;
}

function readCart(): CartItem[] {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as CartItem[];
    return parsed
      .map((item) => {
        const product = getProduct(item.slug);
        if (!product || item.qty <= 0) return null;
        return { ...item, slug: product.slug, name: product.name };
      })
      .filter((item): item is CartItem => Boolean(item));
  } catch {
    return empty;
  }
}

let itemsSnapshot: CartItem[] = empty;
let drawerOpen = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getItemsSnapshot() {
  return itemsSnapshot;
}

function writeItems(next: CartItem[]) {
  itemsSnapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  emit();
}

if (typeof window !== "undefined") {
  itemsSnapshot = readCart();
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribe, getItemsSnapshot, () => empty);
  const isDrawerOpen = useSyncExternalStore(
    subscribe,
    () => drawerOpen,
    () => false,
  );

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    const key = itemKey(item);
    const current = itemsSnapshot;
    const existing = current.find((p) => itemKey(p) === key);
    writeItems(
      existing
        ? current.map((p) =>
            itemKey(p) === key ? { ...p, qty: clampQty(p.qty + qty) } : p,
          )
        : [...current, { ...item, qty: clampQty(qty) }],
    );
    drawerOpen = true;
    emit();
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    writeItems(
      itemsSnapshot
        .map((p) => (itemKey(p) === key ? { ...p, qty: clampQty(qty) } : p))
        .filter((p) => p.qty > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    writeItems(itemsSnapshot.filter((p) => itemKey(p) !== key));
  }, []);

  const clear = useCallback(() => writeItems([]), []);

  const setDrawerOpen = useCallback((open: boolean) => {
    drawerOpen = open;
    emit();
  }, []);

  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const value = useMemo(
    () => ({
      items,
      count,
      subtotal,
      addItem,
      updateQty,
      removeItem,
      clear,
      drawerOpen: isDrawerOpen,
      setDrawerOpen,
    }),
    [
      items,
      count,
      subtotal,
      addItem,
      updateQty,
      removeItem,
      clear,
      isDrawerOpen,
      setDrawerOpen,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
