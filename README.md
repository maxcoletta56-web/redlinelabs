# Redline Labs storefront

Modern rebuild of the [redlinelabs.shop](https://redlinelabs.shop) catalogue as a Next.js app: dark gold branding, full product catalog, cart, and checkout.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What’s included

- Home, shop (search / category / sort), product pages with MG/IU options
- Account profile (sign-up required): order history with COA requests and tracking, store credit, saved addresses, stock alerts
- Persistent cart (localStorage), drawer, cart page, checkout form
- About, contact, FAQ, shipping, refund, privacy, and terms pages
- Research-use-only notices throughout

Card checkout uses Whop’s embedded checkout on `/checkout`. The server prices the cart from the catalogue (including 10% off orders of $200 or more), saves the order as pending, and creates a Whop checkout configuration in AUD. Bank transfer stays on the same page. Sandbox is the default until `WHOP_ENV=production`. `WHOP_API_KEY` stays on the server. Contact and newsletter forms are still front-end demonstrations.

## Stack

Next.js 16, React 19, Tailwind CSS 4, TypeScript.
