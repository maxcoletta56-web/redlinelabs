# Redline Labs storefront

Modern rebuild of the [redlinelabs.shop](https://redlinelabs.shop) catalogue as a Next.js app: dark gold branding, full product catalog, cart, and PayPal card checkout.

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

Card checkout charges through PayPal. The server creates an order with `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, then sends the customer to PayPal’s guest card checkout. Production uses the live PayPal API. The order is captured when the customer returns to the success page. Contact and newsletter forms are still front-end demonstrations.

Bank-transfer checkout stores the order, then emails the customer the same PayID instructions shown on `/order/[reference]` and sends the merchant a copy. Marking that order paid with `POST /api/admin/orders/[reference]/paid` emails the customer that payment was received. Create a [Resend](https://resend.com) account, verify the sending domain, and add `RESEND_API_KEY` plus `ORDER_EMAIL_FROM` (for example `Redline Labs <orders@redlinelabs.shop>`) in Vercel under Project Settings → Environment Variables. `ORDER_NOTIFY_EMAIL` is the merchant inbox; when it is unset the mailer uses `PAYID_ADDRESS`. If `RESEND_API_KEY` is missing, checkout still completes, the mailer logs once, and no email is sent. Names and a short setup note are in `env.example`.

Redline Club (points programme) setup, the outstanding rate decisions and the deployment checklist are in [docs/redline-club.md](docs/redline-club.md). Earning and redemption stay off until those decisions are made.

## Stack

Next.js 16, React 19, Tailwind CSS 4, TypeScript.
