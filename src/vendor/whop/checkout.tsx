"use client";
/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ./LICENSE. */

import { createElement, type ReactNode } from "react";
import { createNamespaceReact } from "./react/namespace";

const checkoutNamespace = createNamespaceReact(
  "checkout",
  [
    { key: "checkout", events: [] },
    { key: "expressCheckout", events: [] },
  ],
  ["onComplete"],
  [],
);

const CheckoutProvider = checkoutNamespace.HandleProvider;
const CheckoutFrame = checkoutNamespace.components.checkout;

export type CheckoutElementProps = {
  checkoutConfiguration: string;
  returnUrl?: string;
  buyerEmail?: string;
  lockBuyerEmail?: boolean;
  children?: ReactNode;
};

/** Embedded checkout session. Props are forwarded to `checkout.create`. */
export function Checkout(props: CheckoutElementProps) {
  return createElement(CheckoutProvider, props as Record<string, unknown>);
}

export const useCheckout = checkoutNamespace.useHandle;

export function CheckoutElement() {
  if (!CheckoutFrame) {
    throw new Error("Whop checkout element is missing");
  }
  return createElement(CheckoutFrame, {});
}
