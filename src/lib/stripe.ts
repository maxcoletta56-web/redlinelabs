import "server-only";

import Stripe from "stripe";
import { resolveStripeKeys } from "@/lib/stripe-keys";

export function stripeResolved() {
  return resolveStripeKeys(process.env);
}

export function stripeSecretKey() {
  return stripeResolved()?.secret;
}

export function stripePublishableKey() {
  return stripeResolved()?.publishable;
}

export function stripeMode() {
  return stripeResolved()?.mode;
}

export function stripeConfigured() {
  return Boolean(stripeResolved());
}

let client: Stripe | undefined;
let clientKey: string | undefined;

function getStripe() {
  const resolved = stripeResolved();
  if (!resolved) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client || clientKey !== resolved.secret) {
    client = new Stripe(resolved.secret);
    clientKey = resolved.secret;
  }
  return client;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const value = Reflect.get(getStripe(), property) as unknown;
    return typeof value === "function" ? (value as (...args: never[]) => unknown).bind(getStripe()) : value;
  },
});
