import type { NextConfig } from "next";
import { productRedirects } from "./src/lib/slugs";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' mailto: https://www.paypal.com https://www.sandbox.paypal.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://assistloop.ai https://va.vercel-scripts.com https://cdn.whop.com https://pay.google.com https://applepay.cdn-apple.com https://js.braintreegateway.com https://www.paypal.com https://www.sandbox.paypal.com https://c.paypal.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i0.wp.com https://www.paypalobjects.com",
  "font-src 'self' data:",
  "connect-src 'self' https://assistloop.ai https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.whop.com https://sandbox-api.whop.com https://pay.google.com https://google.com https://account.google.com https://www.google.com https://api.basistheory.com https://payments.braintree-api.com https://payments.sandbox.braintree-api.com https://api.braintreegateway.com https://api.sandbox.braintreegateway.com https://api-m.paypal.com https://api-m.sandbox.paypal.com https://www.paypal.com https://www.sandbox.paypal.com",
  "frame-src https://cdn.whop.com https://checkout.paypal.com https://assets.braintreegateway.com https://www.paypal.com https://www.sandbox.paypal.com",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i0.wp.com",
        pathname: "/redlinelabs.shop/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.redlinelabs.shop" }],
        destination: "https://redlinelabs.shop/:path*",
        permanent: true,
      },
      ...productRedirects(),
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
