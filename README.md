# Redline Labs storefront

Modern rebuild of the [redlinelabs.shop](https://redlinelabs.shop) catalogue as a Next.js app: dark gold branding, full product catalog, cart, and Payoneer Checkout.

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

Checkout charges through Payoneer. The server creates a payment list with `PAYONEER_MERCHANT_CODE` and `PAYONEER_PAYMENT_TOKEN`, then sends the customer to Payoneer’s hosted payment page. Production uses the live Payoneer API. Contact and newsletter forms are still front-end demonstrations.

Bank-transfer checkout stores the order, then emails the customer the same PayID instructions shown on `/order/[reference]` and sends the merchant a copy. Marking that order paid with `POST /api/admin/orders/[reference]/paid` emails the customer that payment was received. Create a [Resend](https://resend.com) account, verify the sending domain, and add `RESEND_API_KEY` plus `ORDER_EMAIL_FROM` (for example `Redline Labs <orders@redlinelabs.shop>`) in Vercel under Project Settings → Environment Variables. `ORDER_NOTIFY_EMAIL` is the merchant inbox; when it is unset the mailer uses `PAYID_ADDRESS`. If `RESEND_API_KEY` is missing, checkout still completes, the mailer logs once, and no email is sent. Names and a short setup note are in `env.example`.

## Stack

Next.js 16, React 19, Tailwind CSS 4, TypeScript.
