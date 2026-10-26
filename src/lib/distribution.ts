import { randomBytes } from "node:crypto";
import { AU_STATES, isAuState, normalizeEmail } from "./account-data.ts";
import { boxFieldSku, priceFieldName } from "./distribution-fields.ts";
import { optionLabel } from "./variant-label.ts";

/**
 * Distribution accounts are a separate login from shop accounts.
 * A box is 10 retail units. The shop catalogue price is unchanged.
 * Listed products carry a distributor price per box. Each line needs at least
 * four boxes. The desk can still replace a box price on a saved quote.
 */
export const DISTRIBUTION_UNITS_PER_BOX = 10;
export const DISTRIBUTION_MIN_BOXES = 4;

/**
 * Distributor price for one box, in cents. Keys are catalogue SKUs.
 * Tesamorelin/Ipamorelin, TA1, and 20 ml BAC water are not catalogue listings.
 * SLU-PP-332 carries the sheet price published as SLU-PP-375 5 mg.
 */
export const DISTRIBUTION_BOX_CENTS: Readonly<Record<string, number>> = {
  Reta10: 300_00,
  Ret1313: 400_00,
  Ret2020: 500_00,
  Ipaipa: 300_00,
  Tesa10: 500_00,
  Kisspep: 400_00,
  Igf1g: 400_00,
  ghkcu: 350_00,
  Bpc13: 350_00,
  Bpc20: 450_00,
  Tb512: 350_00,
  Tb520: 450_00,
  TB4: 500_00,
  Glow70: 550_00,
  Klow80: 650_00,
  Epi50: 500_00,
  Dsip15: 500_00,
  Nad1000: 500_00,
  Motc10: 385_00,
  Ss31s: 450_00,
  Kpvvpm: 400_00,
  HMG75: 300_00,
  HCG5K: 300_00,
  HCG10K: 450_00,
  Pt141: 300_00,
  Semax10: 400_00,
  Selank10: 400_00,
  MT2: 200_00,
  Bac09: 50_00,
  Slupp37: 375_00,
};

export const DISTRIBUTION_QUOTE_PREFIX = "DQ";
const QUOTE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const QUOTE_BODY_LENGTH = 6;
const MAX_BOXES_PER_LINE = 50;
const MAX_BOXES_PER_QUOTE = 500;
const MAX_QUOTE_LINES = 40;
const MAX_NOTE_LENGTH = 500;
const MAX_REVIEW_NOTE_LENGTH = 500;

export const DISTRIBUTION_ACCOUNT_STATUSES = ["pending", "approved", "rejected"] as const;
export const DISTRIBUTION_QUOTE_STATUSES = ["requested", "quoted", "accepted", "declined"] as const;

export type DistributionAccountStatus = (typeof DISTRIBUTION_ACCOUNT_STATUSES)[number];
export type DistributionQuoteStatus = (typeof DISTRIBUTION_QUOTE_STATUSES)[number];

export const DISTRIBUTION_REGIONS = [...AU_STATES, "OTHER"] as const;
export type DistributionRegion = (typeof DISTRIBUTION_REGIONS)[number];

export const DISTRIBUTION_ERRORS = {
  business: "Enter the business name.",
  contact: "Enter a contact name.",
  email: "Enter a valid email address.",
  phone: "Enter a phone number we can reach.",
  abn: "ABN must be 11 digits, or leave it blank.",
  region: "Select a state, territory, or outside Australia.",
  website: "Website must start with http:// or https://.",
  message: "Keep the note under 1000 characters.",
  password: "Password must be at least 8 characters.",
  confirm: "Confirm you are 18 or older and that supply is for laboratory research.",
  exists: "An application for this email already exists. Sign in to check it.",
  limited: "Too many attempts. Try again in a few minutes.",
  unavailable: "Distribution accounts are unavailable until the database is configured.",
  unconfigured: "Distribution sign-in is not configured.",
  credentials: "Email or password was not recognised.",
  empty: "Enter at least one box.",
  minimum: "Each product needs at least 4 boxes.",
  quote: "Check the box quantities and try again.",
  note: "Keep the note under 500 characters.",
  forbidden: "Quote requests are available after the application is approved.",
  signin: "Sign in with an approved distribution account.",
  save: "Could not save that. Try again.",
} as const;

export type DistributionErrorCode = keyof typeof DISTRIBUTION_ERRORS;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d][\d\s()+-]{7,29}$/;

export type CatalogVariant = {
  option: string;
  price: number;
  sku: string;
};

export type CatalogProduct = {
  name: string;
  slug: string;
  sku?: string;
  minPrice?: number;
  variantLabel?: string | null;
  variants: CatalogVariant[];
};

export type BoxOffer = {
  slug: string;
  name: string;
  sku: string;
  option: string;
  optionLabel: string;
  retailUnitCents: number;
  /** Distributor price for one box, in cents. Zero when the sheet has no price. */
  boxCents: number;
  unitsPerBox: number;
};

export type DistributionApplication = {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  abn: string;
  region: DistributionRegion;
  website: string;
  message: string;
};

export type DistributionQuoteLine = {
  slug: string;
  name: string;
  sku: string;
  option: string;
  boxes: number;
  unitsPerBox: number;
  retailUnitCents: number;
  /** Price of one box, in cents. A listed product starts from the distributor sheet. */
  boxCents: number;
  boxUnitCents: number;
  lineCents: number;
};

export function distributionErrorMessage(code: string) {
  if (Object.prototype.hasOwnProperty.call(DISTRIBUTION_ERRORS, code)) {
    return DISTRIBUTION_ERRORS[code as DistributionErrorCode];
  }
  return "Could not continue. Try again.";
}

export function distributionRegionLabel(region: string) {
  if (region === "OTHER") return "Outside Australia";
  return region;
}

export function isDistributionRegion(value: string): value is DistributionRegion {
  return isAuState(value) || value === "OTHER";
}

/** Dollars and cents typed on the desk, such as "665" or "665.50". */
export function audToCents(raw: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = dollars * 100 + fraction;
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100_000_000) return null;
  return cents;
}

export function retailCents(price: number) {
  if (!Number.isFinite(price) || price < 0) throw new Error("Retail price must be a positive amount");
  return Math.round(price * 100);
}

function catalogVariants(product: CatalogProduct): CatalogVariant[] {
  if (product.variants.length > 0) return product.variants;
  if (!product.sku || product.minPrice == null || !Number.isFinite(product.minPrice)) return [];
  return [{ option: "Vial", price: product.minPrice, sku: product.sku }];
}

export function boxOffers(catalog: readonly CatalogProduct[]): BoxOffer[] {
  const seen = new Set<string>();
  const offers: BoxOffer[] = [];
  for (const product of catalog) {
    for (const variant of catalogVariants(product)) {
      if (seen.has(variant.sku)) {
        throw new Error(`Duplicate catalogue SKU ${variant.sku}`);
      }
      seen.add(variant.sku);
      offers.push({
        slug: product.slug,
        name: product.name,
        sku: variant.sku,
        option: variant.option,
        optionLabel: optionLabel(product, variant.option),
        retailUnitCents: retailCents(variant.price),
        boxCents: DISTRIBUTION_BOX_CENTS[variant.sku] ?? 0,
        unitsPerBox: DISTRIBUTION_UNITS_PER_BOX,
      });
    }
  }
  return offers;
}

export function groupBoxOffers(offers: readonly BoxOffer[]) {
  const groups: Array<{ slug: string; name: string; offers: BoxOffer[] }> = [];
  for (const offer of offers) {
    const current = groups[groups.length - 1];
    if (current && current.slug === offer.slug) current.offers.push(offer);
    else groups.push({ slug: offer.slug, name: offer.name, offers: [offer] });
  }
  return groups;
}

const QUOTE_REFERENCE_PATTERN = new RegExp(
  `^${DISTRIBUTION_QUOTE_PREFIX}-[${QUOTE_ALPHABET}]{${QUOTE_BODY_LENGTH}}$`,
);

export function isDistributionQuoteReference(value: string | null | undefined): boolean {
  return typeof value === "string" && QUOTE_REFERENCE_PATTERN.test(value);
}

export function normalizeDistributionQuoteReference(value: string | null | undefined) {
  const candidate = value?.trim().toUpperCase() ?? "";
  return isDistributionQuoteReference(candidate) ? candidate : null;
}

export function generateDistributionQuoteReference(
  bytes: Uint8Array = randomBytes(QUOTE_BODY_LENGTH),
) {
  if (bytes.length < QUOTE_BODY_LENGTH) {
    throw new Error("Quote reference needs at least six random bytes");
  }
  let body = "";
  for (let index = 0; index < QUOTE_BODY_LENGTH; index += 1) {
    body += QUOTE_ALPHABET[bytes[index] % QUOTE_ALPHABET.length];
  }
  return `${DISTRIBUTION_QUOTE_PREFIX}-${body}`;
}

function cleanLine(value: string, max: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function readFormString(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function applicationFromForm(
  form: FormData,
): { ok: true; application: DistributionApplication; password: string } | { ok: false; error: DistributionErrorCode } {
  const businessName = cleanLine(readFormString(form, "businessName"), 120);
  const contactName = cleanLine(readFormString(form, "contactName"), 120);
  const email = normalizeEmail(readFormString(form, "email"));
  const phone = cleanLine(readFormString(form, "phone"), 30);
  const abn = readFormString(form, "abn").replace(/\s+/g, "");
  const region = cleanLine(readFormString(form, "region"), 16);
  const website = cleanLine(readFormString(form, "website"), 200);
  const message = readFormString(form, "message").replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  const password = readFormString(form, "password");

  if (!businessName || readFormString(form, "businessName").trim().length > 120) {
    return { ok: false, error: "business" };
  }
  if (!contactName || readFormString(form, "contactName").trim().length > 120) {
    return { ok: false, error: "contact" };
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 200) return { ok: false, error: "email" };
  if (!PHONE_PATTERN.test(phone)) return { ok: false, error: "phone" };
  if (abn && !/^\d{11}$/.test(abn)) return { ok: false, error: "abn" };
  if (!isDistributionRegion(region)) return { ok: false, error: "region" };
  if (website) {
    try {
      const url = new URL(website);
      if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: "website" };
    } catch {
      return { ok: false, error: "website" };
    }
  }
  if (message.length > 1000) return { ok: false, error: "message" };
  if (password.length < 8 || password.length > 200) return { ok: false, error: "password" };
  if (form.get("ageConfirmed") !== "on" || form.get("researchUse") !== "on") {
    return { ok: false, error: "confirm" };
  }

  return {
    ok: true,
    password,
    application: {
      businessName,
      contactName,
      email,
      phone,
      abn,
      region,
      website,
      message,
    },
  };
}

export function parseQuoteRequest(
  form: FormData,
  offers: readonly BoxOffer[],
):
  | { ok: true; lines: DistributionQuoteLine[]; note: string; subtotalCents: number }
  | { ok: false; error: DistributionErrorCode } {
  const note = readFormString(form, "note").replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: "note" };

  const bySku = new Map(offers.map((offer) => [offer.sku, offer]));
  const seen = new Set<string>();
  const lines: DistributionQuoteLine[] = [];

  for (const [key, value] of form.entries()) {
    const sku = boxFieldSku(key);
    if (!sku) continue;
    if (seen.has(sku)) return { ok: false, error: "quote" };
    seen.add(sku);
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw || raw === "0") continue;
    if (!/^\d+$/.test(raw)) return { ok: false, error: "quote" };
    const boxes = Number(raw);
    if (boxes === 0) continue;
    if (!Number.isInteger(boxes) || boxes > MAX_BOXES_PER_LINE) {
      return { ok: false, error: "quote" };
    }
    const offer = bySku.get(sku);
    if (!offer) return { ok: false, error: "quote" };
    if (boxes < DISTRIBUTION_MIN_BOXES) return { ok: false, error: "minimum" };
    const boxCents = offer.boxCents;
    lines.push({
      slug: offer.slug,
      name: offer.name,
      sku: offer.sku,
      option: offer.optionLabel,
      boxes,
      unitsPerBox: offer.unitsPerBox,
      retailUnitCents: offer.retailUnitCents,
      boxCents,
      boxUnitCents: boxCents > 0 ? Math.round(boxCents / offer.unitsPerBox) : 0,
      lineCents: boxCents * boxes,
    });
  }

  if (lines.length === 0) return { ok: false, error: "empty" };
  if (lines.length > MAX_QUOTE_LINES) return { ok: false, error: "quote" };
  const totalBoxes = lines.reduce((sum, line) => sum + line.boxes, 0);
  if (totalBoxes > MAX_BOXES_PER_QUOTE) return { ok: false, error: "quote" };
  return {
    ok: true,
    lines,
    note,
    subtotalCents: lines.reduce((sum, line) => sum + line.lineCents, 0),
  };
}

/** Replaces every line price with the amount typed on the desk. */
export function applyQuotePrices(lines: readonly DistributionQuoteLine[], form: FormData) {
  if (lines.length === 0) return { ok: false as const };
  const priced: DistributionQuoteLine[] = [];
  for (const line of lines) {
    const boxCents = audToCents(readFormString(form, priceFieldName(line.sku)));
    if (boxCents === null || line.unitsPerBox < 1) return { ok: false as const };
    priced.push({
      ...line,
      boxCents,
      boxUnitCents: Math.round(boxCents / line.unitsPerBox),
      lineCents: boxCents * line.boxes,
    });
  }
  return {
    ok: true as const,
    lines: priced,
    subtotalCents: priced.reduce((sum, line) => sum + line.lineCents, 0),
  };
}

export function quoteIsPriced(lines: readonly Pick<DistributionQuoteLine, "boxCents">[]) {
  return lines.length > 0 && lines.every((line) => line.boxCents > 0);
}

export function cleanReviewNote(value: unknown) {
  const note = (typeof value === "string" ? value : "").replace(/\u0000/g, "").trim();
  if (note.length > MAX_REVIEW_NOTE_LENGTH) return null;
  return note;
}

export function distributionAccountStatusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Not approved";
  return "Awaiting approval";
}

export function distributionQuoteStatusLabel(status: string) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  if (status === "quoted") return "Priced";
  return "Awaiting price";
}

export function summarizeDistributionQuote(lines: readonly DistributionQuoteLine[]) {
  if (lines.length === 0) return "No lines stored";
  const boxes = lines.reduce((sum, line) => sum + line.boxes, 0);
  const preview = lines
    .slice(0, 3)
    .map((line) => `${line.boxes} × ${line.name} ${line.option}`)
    .join(", ");
  const extra = lines.length > 3 ? ` +${lines.length - 3} more` : "";
  return `${boxes} box${boxes === 1 ? "" : "es"} · ${preview}${extra}`;
}

export function distributionDeskStats(
  accounts: readonly { status: string }[],
  quotes: readonly { status: string; subtotalCents: number }[],
) {
  const awaiting = quotes.filter((quote) => quote.status === "requested");
  const priced = quotes.filter((quote) => quote.status === "quoted" || quote.status === "accepted");
  return {
    pending: accounts.filter((account) => account.status === "pending").length,
    approved: accounts.filter((account) => account.status === "approved").length,
    awaitingPrice: awaiting.length,
    pricedQuotes: priced.length,
    pricedCents: priced.reduce((sum, quote) => sum + quote.subtotalCents, 0),
  };
}

export function distributionPortalNotice(notice: string | undefined, reference: string | undefined) {
  if (notice === "applied") {
    return "Application received. Box prices stay hidden until it is approved.";
  }
  if (notice === "quoted") {
    const normalized = normalizeDistributionQuoteReference(reference);
    return normalized
      ? `Quote ${normalized} is saved at the distributor box prices. It is not a shop order.`
      : "Quote saved.";
  }
  return null;
}

export function distributionAdminNotice(notice: string | undefined, reference: string | undefined) {
  switch (notice) {
    case "approved":
      return "Account approved. They can sign in and request box quotes.";
    case "rejected":
      return "Account marked not approved. Box prices stay hidden.";
    case "priced": {
      const normalized = normalizeDistributionQuoteReference(reference);
      return normalized ? `Saved box prices on ${normalized}.` : "Box prices saved.";
    }
    case "price":
      return "Enter a box price for every line, in dollars and cents.";
    case "unpriced":
      return "Enter a box price on every line before accepting the quote.";
    case "accepted": {
      const normalized = normalizeDistributionQuoteReference(reference);
      return normalized ? `Accepted quote ${normalized}.` : "Quote accepted.";
    }
    case "declined": {
      const normalized = normalizeDistributionQuoteReference(reference);
      return normalized ? `Declined quote ${normalized}.` : "Quote declined.";
    }
    case "missing":
      return "That record was not found.";
    case "invalid":
      return "That update was not accepted.";
    case "unavailable":
      return "Distribution records are unavailable until the database is configured.";
    case "failed":
      return "Could not update that record.";
    default:
      return null;
  }
}
