import "server-only";

import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function checkoutOrigin(request: Request) {
  const fromHeader = request.headers.get("origin");
  if (fromHeader) return fromHeader;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}
