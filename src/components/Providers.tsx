"use client";

import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/CartDrawer";
import { NewsletterPopup } from "@/components/NewsletterPopup";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartDrawer />
      <NewsletterPopup />
    </CartProvider>
  );
}
