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
        destination: "/product/bac-water",
        permanent: true,
      },
      {
        source: "/product/bacterial-water",
        destination: "/product/bac-water",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
