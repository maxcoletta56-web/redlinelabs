import "server-only";

import Stripe from "stripe";

const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_/;
const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_/;

const SECRET_KEY_NAMES = ["STRIPE_SECRET_KEY", "REDLINE_STRIPE_SECRET_KEY"] as const;
const PUBLISHABLE_KEY_NAMES = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_REDLINE_STRIPE_PUBLISHABLE_KEY",
  "REDLINE_STRIPE_PUBLISHABLE_KEY",
] as const;

function firstMatchingEnv(names: readonly string[], pattern: RegExp) {
  for (const name of names) {
    const value = process.env[name];
    if (value && pattern.test(value)) {
      return value;
    }
  }

  // Ignore key IDs (mk_...) and names that accidentally stored the key in the
  // variable name. Prefer any env value that is an actual Stripe key.
  for (const value of Object.values(process.env)) {
    if (typeof value === "string" && pattern.test(value)) {
      return value;
    }
  }

  return undefined;
}

export function stripeSecretKey() {
  return firstMatchingEnv(SECRET_KEY_NAMES, SECRET_KEY_PATTERN);
}

export function stripePublishableKey() {
  return firstMatchingEnv(PUBLISHABLE_KEY_NAMES, PUBLISHABLE_KEY_PATTERN);
}

export function stripeConfigured() {
  return Boolean(stripeSecretKey() && stripePublishableKey());
}

let client: Stripe | undefined;

function getStripe() {
  if (client) return client;
  const key = stripeSecretKey();
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
