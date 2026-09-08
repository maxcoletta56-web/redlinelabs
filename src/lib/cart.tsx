"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getProduct } from "./products";

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

export function itemKey(item: Pick<CartItem, "slug" | "option">) {
  return `${item.slug}::${item.option ?? "default"}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        setItems(
          parsed.filter((item) => getProduct(item.slug) && item.qty > 0),
        );
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const key = itemKey(item);
      const existing = prev.find((p) => itemKey(p) === key);
      if (existing) {
        return prev.map((p) =>
          itemKey(p) === key ? { ...p, qty: p.qty + qty } : p,
        );
      }
      return [...prev, { ...item, qty }];
    });
    setDrawerOpen(true);
  }, []);

  const updateQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => (itemKey(p) === key ? { ...p, qty } : p))
        .filter((p) => p.qty > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => itemKey(p) !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

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
      drawerOpen,
      setDrawerOpen,
    }),
    [items, count, subtotal, addItem, updateQty, removeItem, clear, drawerOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
