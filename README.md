# Redline Labs storefront

Modern rebuild of the [redlinelabs.shop](https://redlinelabs.shop) catalogue as a Next.js app: dark gold branding, full product catalog, cart, and Stripe checkout.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s included

- Home, shop (search / category / sort), product pages with MG/IU options
- Persistent cart (localStorage), drawer, cart page, checkout form, Stripe Embedded Checkout
- About, contact, FAQ, shipping, refund, privacy, and terms pages
- Research-use-only notices throughout

## Stripe setup

Create a local `.env.local` from `env.example` and set:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (recommended for local development and previews)

The checkout page creates Stripe Checkout Sessions server-side, recalculates prices from the catalogue, and embeds card collection on-page.

## Stack

Next.js 16, React 19, Tailwind CSS 4, TypeScript.
