# Redline Labs storefront

Modern rebuild of the [redlinelabs.shop](https://redlinelabs.shop) catalogue as a Next.js app: dark gold branding, full product catalog, cart, and a demo checkout.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s included

- Home, shop (search / category / sort), product pages with MG/IU options
- Persistent cart (localStorage), drawer, cart page, checkout form
- About, contact, FAQ, shipping, refund, privacy, and terms pages
- Research-use-only notices throughout

Checkout uses Stripe Embedded Checkout. Copy `env.example` to `.env.local` and
fill in the Stripe keys, then restart the dev server. Without them the cart still
works and checkout says Stripe is not configured.

## Stack

Next.js 16, React 19, Tailwind CSS 4, TypeScript.
