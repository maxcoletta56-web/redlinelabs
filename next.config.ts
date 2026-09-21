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
};

export default nextConfig;
