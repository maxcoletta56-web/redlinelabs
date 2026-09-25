import type { Metadata } from "next";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://redlinelabs.shop";

export const DEFAULT_OG_IMAGE = "/opengraph-image.png";

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, SITE_URL).toString();
}

export function metaDescription(text: string, max = 160) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const sentences = compact.split(/(?<=\.)\s+/);
  let assembled = sentences[0] ?? compact;
  for (const sentence of sentences.slice(1)) {
    if (assembled.length >= 140) break;
    const next = `${assembled} ${sentence}`;
    if (next.length > max) break;
    assembled = next;
  }
  if (assembled.endsWith(".") && assembled.length <= max) {
    return assembled.length >= 140 || sentences.length === 1 ? assembled : padDescription(compact, max);
  }
  if (compact.length <= max) return compact;
  const sliced = compact.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 40 ? lastSpace : max - 1;
  return `${sliced.slice(0, cut)}…`;
}

function padDescription(text: string, max: number) {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${sliced.slice(0, lastSpace > 40 ? lastSpace : max - 1)}…`;
}

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
  imageAlt?: string;
  index?: boolean;
  absoluteTitle?: boolean;
};

export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  imageAlt = "Redline Labs research catalogue",
  index = true,
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const desc = metaDescription(description);
  const socialTitle = absoluteTitle
    ? title
    : title.includes("Redline Labs")
      ? title
      : `${title} | Redline Labs`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "en_AU",
      siteName: "Redline Labs",
      title: socialTitle,
      description: desc,
      url,
      images: [{ url: absoluteUrl(image), alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: desc,
      images: [absoluteUrl(image)],
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ label: string; href?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}
