import { statSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { products } from "@/lib/products";
import { absoluteUrl } from "@/lib/seo";

const publicRoutes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/comments", changeFrequency: "monthly", priority: 0.6 },
  { path: "/shipping-policy", changeFrequency: "monthly", priority: 0.6 },
  { path: "/refund-policy", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy-policy", changeFrequency: "monthly", priority: 0.6 },
  { path: "/terms-of-service", changeFrequency: "monthly", priority: 0.6 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const catalogUpdatedAt = statSync(join(process.cwd(), "src/data/products.json")).mtime;
  const pageUpdatedAt = {
    "/": statSync(join(process.cwd(), "src/app/page.tsx")).mtime,
    "/shop": statSync(join(process.cwd(), "src/app/shop/page.tsx")).mtime,
    "/about": statSync(join(process.cwd(), "src/app/about/page.tsx")).mtime,
    "/faq": statSync(join(process.cwd(), "src/app/faq/page.tsx")).mtime,
    "/contact": statSync(join(process.cwd(), "src/app/contact/page.tsx")).mtime,
    "/comments": statSync(join(process.cwd(), "src/app/comments/page.tsx")).mtime,
    "/shipping-policy": statSync(join(process.cwd(), "src/app/shipping-policy/page.tsx")).mtime,
    "/refund-policy": statSync(join(process.cwd(), "src/app/refund-policy/page.tsx")).mtime,
    "/privacy-policy": statSync(join(process.cwd(), "src/app/privacy-policy/page.tsx")).mtime,
    "/terms-of-service": statSync(join(process.cwd(), "src/app/terms-of-service/page.tsx")).mtime,
  } as const;
  return [
    ...publicRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: pageUpdatedAt[route.path],
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/product/${product.slug}`),
      lastModified: catalogUpdatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
