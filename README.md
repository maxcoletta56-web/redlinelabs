# Redline Labs storefront

Modern rebuild of the [redlinelabs.shop](https://redlinelabs.shop) catalogue as a Next.js app: dark gold branding, full product catalog, cart, and Stripe Checkout.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s included

- Home, shop (search / category / sort), product pages with MG/IU options
- Account profile (sign-up required): order history with COA requests and tracking, store credit, saved addresses, stock alerts, and $15 mate-referral credit
- Persistent cart (localStorage), drawer, cart page, checkout form
- About, contact, FAQ, shipping, refund, privacy, and terms pages
- Research-use-only notices throughout

Checkout charges through Stripe. Production uses live keys (`sk_live_` / `pk_live_`); test keys are ignored on the live site. Contact and newsletter forms are still front-end demonstrations.

## Stack

Next.js 16, React 19, Tailwind CSS 4, TypeScript.
