import type { NextConfig } from "next";

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
        source: "/product/product-bacterial-water",
        destination: "/shop",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
