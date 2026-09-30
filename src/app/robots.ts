import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const privatePaths = ["/account", "/admin", "/cart", "/checkout", "/order", "/api/"];

const aiCrawlers = [
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  const publicAccess = {
    allow: "/",
    disallow: privatePaths,
  };
  return {
    rules: [
      { userAgent: "*", ...publicAccess },
      { userAgent: aiCrawlers, ...publicAccess },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
