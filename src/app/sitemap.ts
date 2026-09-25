import type { MetadataRoute } from "next";
import { products } from "@/lib/products";
import { absoluteUrl } from "@/lib/seo";

const publicRoutes = [
  "/",
  "/shop",
  "/about",
  "/faq",
  "/contact",
  "/shipping-policy",
  "/refund-policy",
  "/privacy-policy",
  "/terms-of-service",
] as const;

const CATALOG_UPDATED_AT = new Date("2026-09-25T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = CATALOG_UPDATED_AT;
  const pages: MetadataRoute.Sitemap = publicRoutes.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/shop" || path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/shop" ? 0.9 : 0.6,
  }));
  return [
    ...pages,
    ...products.map((product) => ({
      url: absoluteUrl(`/product/${product.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
