export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://redlinelabs.shop";

export function absoluteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, SITE_URL).toString();
}

export function metaDescription(text: string, max = 155) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const sentence = compact.split(/(?<=\.)\s/)[0] ?? compact;
  if (sentence.endsWith(".") && sentence.length <= max) return sentence;
  if (compact.length <= max) return compact;
  const sliced = compact.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 40 ? lastSpace : max - 1;
  return `${sliced.slice(0, cut)}…`;
}
