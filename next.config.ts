import type { NextConfig } from "next";
import { productRedirects } from "./src/lib/slugs";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' mailto: https://resources.live.oscato.com https://resources.sandbox.oscato.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://assistloop.ai https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i0.wp.com",
  "font-src 'self' data:",
  "connect-src 'self' https://assistloop.ai https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  "frame-src 'none'",
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
