import {
  BRAND_NAME,
  COMPANY_EMAIL,
  COMPANY_NUMBER,
  INCORPORATION_DATE_LABEL,
  LEGAL_NAME,
  RESEARCH_DISCLAIMER,
} from "./company";
import { products } from "./products";
import { absoluteUrl } from "./seo";

const pages: Array<[string, string, string]> = [
  ["/", "Home", "Catalogue overview for laboratory research chemicals in Australia."],
  ["/shop", "Catalogue", "Browse listings by name, SKU, or category. Prices are in AUD."],
  ["/about", "About", "Registered company, testing notes, and dispatch."],
  ["/faq", "FAQ", "Research-use supply, certificates of analysis, dispatch, and contact."],
  ["/contact", "Contact", `Email ${COMPANY_EMAIL}. Published hours are Monday–Sunday, 6AM–6PM AEST.`],
  ["/shipping-policy", "Shipping policy", "Australia-wide dispatch and typical processing times."],
  ["/refund-policy", "Refund policy", "When refunds may be reviewed."],
  ["/privacy-policy", "Privacy policy", "How order and account information is handled."],
  ["/terms-of-service", "Terms of service", "Terms for using the storefront."],
  ["/comments", "Comments", "Public comments stored as written. Not product advice."],
];

export function llmsText() {
  const pageLinks = pages
    .map(([path, label, detail]) => `- [${label}](${absoluteUrl(path)}): ${detail}`)
    .join("\n");
  const catalogue = products
    .map((product) => `- [${product.name}](${absoluteUrl(`/product/${product.slug}`)})`)
    .join("\n");

  return `# ${BRAND_NAME}

> ${BRAND_NAME} lists laboratory research chemicals for purchase in Australia. Certificates of analysis are available on request. Research use only, not a pharmacy.

${BRAND_NAME} is the trading name of ${LEGAL_NAME} (Hong Kong company number ${COMPANY_NUMBER}), incorporated on ${INCORPORATION_DATE_LABEL}. The storefront dispatches Australia-wide. No street address is published on this site.

Contact: ${COMPANY_EMAIL}

${RESEARCH_DISCLAIMER}

## Key pages

${pageLinks}

## Catalogue

${catalogue}
`;
}
