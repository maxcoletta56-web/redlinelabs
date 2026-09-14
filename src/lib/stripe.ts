import "server-only";

import Stripe from "stripe";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

let client: Stripe | undefined;

function getStripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  client = new Stripe(key);
  return client;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const value = Reflect.get(getStripe(), property) as unknown;
    return typeof value === "function" ? (value as (...args: never[]) => unknown).bind(getStripe()) : value;
  },
});
