export const BRAND_NAME = "Redline Labs";
export const LEGAL_NAME = "RedlineLabs Limited";
export const COMPANY_NUMBER = "80442501";
export const INCORPORATION_DATE_ISO = "2026-05-20";
export const INCORPORATION_DATE_LABEL = "20 May 2026";
export const JURISDICTION = "Hong Kong";
export const REGISTRY = "Companies Registry of Hong Kong";
export const COMPANY_EMAIL = "redlinelabsltd@pm.me";

/** One-line trust copy for tiles, asides, and contact intros. */
export const REGISTERED_COMPANY_SHORT =
  "A verified registered private corporation incorporated in Hong Kong.";

export const REGISTERED_COMPANY_DETAIL = `${LEGAL_NAME} is a verified registered private corporation incorporated in ${JURISDICTION} on ${INCORPORATION_DATE_LABEL} (${REGISTRY}, company number ${COMPANY_NUMBER}). ${BRAND_NAME} is the trading name of that company.`;

export function footerCopyright(year = new Date().getFullYear()) {
  return `© ${year} ${LEGAL_NAME} (Hong Kong Co. No. ${COMPANY_NUMBER}). Trading as ${BRAND_NAME}.`;
}
