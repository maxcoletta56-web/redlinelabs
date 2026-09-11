import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i0.wp.com",
        pathname: "/redlinelabs.shop/**",
      },
      {
        protocol: "https",
        hostname: "i1.wp.com",
        pathname: "/redlinelabs.shop/**",
      },
      {
        protocol: "https",
        hostname: "i2.wp.com",
        pathname: "/redlinelabs.shop/**",
      },
      {
        protocol: "https",
        hostname: "redlinelabs.shop",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/product/products-kisspeptin",
        destination: "/product/products-kisspepien",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
