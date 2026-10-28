import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isOrderReference } from "./order-reference.ts";
import { priceFieldName } from "./distribution-fields.ts";
import {
  applicationFromForm,
  applyQuotePrices,
  audToCents,
  boxOffers,
  distributionAdminNotice,
  distributionDeskStats,
  distributionPortalNotice,
  DISTRIBUTION_BOX_CENTS,
  DISTRIBUTION_MIN_BOXES,
  distributorBoxCents,
  DISTRIBUTION_UNITS_PER_BOX,
  generateDistributionQuoteReference,
  groupBoxOffers,
  isDistributionQuoteReference,
  normalizeDistributionQuoteReference,
  parseQuoteRequest,
  quoteIsPriced,
  type CatalogProduct,
} from "./distribution.ts";
import {
  CREATE_DISTRIBUTION_ACCOUNTS,
  CREATE_DISTRIBUTION_QUOTES,
  CREATE_DISTRIBUTION_QUOTES_INDEX,
  LIST_DISTRIBUTION_ACCOUNTS,
  SELECT_DISTRIBUTION_ACCOUNT,
} from "./distribution-db.ts";

const catalog = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
) as CatalogProduct[];

function compact(sql: string) {
  return sql.replace(/\s+/g, "");
}

test("a box is ten retail units and the catalogue does not invent a box price", () => {
  assert.equal(DISTRIBUTION_UNITS_PER_BOX, 10);
  const offers = boxOffers([
    {
      name: "DSIP",
      slug: "dsip",
      variantLabel: "MG",
      variants: [{ option: "10", price: 95, sku: "Dsip10" }],
    },
  ]);
  assert.equal(offers[0]?.retailUnitCents, 9500);
  assert.equal(offers[0]?.unitsPerBox, 10);
  assert.equal(offers[0]?.optionLabel, "10 MG");
  assert.equal(offers[0]?.boxCents, 0);
});

test("each listed item is 10% off its own box price, and unlisted sizes stay open", () => {
  assert.equal(DISTRIBUTION_MIN_BOXES, 5);
  assert.equal(distributorBoxCents(50000), 45000);
  assert.equal(distributorBoxCents(38500), 34650);
  assert.equal(distributorBoxCents(37500), 33750);
  assert.equal(distributorBoxCents(0), 0);
  const offers = boxOffers(catalog);
  const bySku = new Map(offers.map((offer) => [offer.sku, offer]));
  for (const [sku, cents] of Object.entries(DISTRIBUTION_BOX_CENTS)) {
    assert.equal(bySku.get(sku)?.boxCents, distributorBoxCents(cents), sku);
  }
  assert.equal(bySku.get("Dsip15")?.boxCents, 45000);
  assert.equal(bySku.get("Dsip10")?.boxCents, 0);
  assert.equal(bySku.get("ghkcu")?.optionLabel, "Vial");
  assert.equal(bySku.get("Motc10")?.boxCents, 34650);
  assert.equal(bySku.get("Bac09")?.boxCents, 4500);
});

test("catalogue offers keep the retail unit price for the desk to read", () => {
  const before = JSON.stringify(catalog);
  const offers = boxOffers(catalog);
  assert.equal(JSON.stringify(catalog), before);
  const skus = new Set(offers.map((offer) => offer.sku));
  assert.equal(skus.size, offers.length);
  assert.ok(offers.length > 10);
  for (const offer of offers) {
    assert.ok(offer.retailUnitCents > 0, offer.sku);
    assert.equal(offer.unitsPerBox, 10);
  }
});

test("a quote stores the sheet box price, and the desk can replace it", () => {
  const offers = boxOffers(catalog);
  const short = new FormData();
  short.set("box_Dsip15", "2");
  assert.equal(parseQuoteRequest(short, offers).ok, false);
  const tooFew = parseQuoteRequest(short, offers);
  if (!tooFew.ok) assert.equal(tooFew.error, "minimum");

  const shortMix = new FormData();
  shortMix.set("box_Dsip15", "2");
  shortMix.set("box_Motc10", "2");
  const belowTotal = parseQuoteRequest(shortMix, offers);
  assert.equal(belowTotal.ok, false);
  if (!belowTotal.ok) assert.equal(belowTotal.error, "minimum");

  const split = new FormData();
  split.set("box_Dsip15", "2");
  split.set("box_Motc10", "3");
  const mixed = parseQuoteRequest(split, offers);
  assert.equal(mixed.ok, true);
  if (!mixed.ok) return;
  assert.equal(mixed.lines.find((line) => line.sku === "Dsip15")?.lineCents, 90000);
  assert.equal(mixed.lines.find((line) => line.sku === "Motc10")?.boxCents, 34650);
  assert.equal(mixed.lines.find((line) => line.sku === "Motc10")?.lineCents, 103950);
  assert.equal(mixed.subtotalCents, 193950);

  const form = new FormData();
  form.set("box_Dsip15", "5");
  form.set("box_Dsip10", "5");
  form.set(priceFieldName("Dsip15"), "1");
  form.set("boxUnitCents", "1");
  const parsed = parseQuoteRequest(form, offers);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.lines.length, 2);
  const listed = parsed.lines.find((line) => line.sku === "Dsip15");
  const open = parsed.lines.find((line) => line.sku === "Dsip10");
  assert.equal(listed?.retailUnitCents, 11000);
  assert.equal(listed?.boxCents, 45000);
  assert.equal(listed?.boxUnitCents, 4500);
  assert.equal(listed?.lineCents, 225000);
  assert.equal(open?.boxCents, 0);
  assert.equal(open?.lineCents, 0);
  assert.equal(parsed.subtotalCents, 225000);
  assert.equal(quoteIsPriced(parsed.lines), false);

  const listedOnly = new FormData();
  listedOnly.set("box_Dsip15", "5");
  listedOnly.set("box_Motc10", "5");
  const sheet = parseQuoteRequest(listedOnly, offers);
  assert.equal(sheet.ok, true);
  if (!sheet.ok) return;
  assert.equal(quoteIsPriced(sheet.lines), true);
  const mots = sheet.lines.find((line) => line.sku === "Motc10");
  assert.equal(mots?.boxCents, 34650);
  assert.equal(mots?.lineCents, 173250);
  assert.equal(sheet.subtotalCents, 225000 + 173250);

  const pricedForm = new FormData();
  pricedForm.set(priceFieldName("Dsip10"), "665.00");
  const priced = applyQuotePrices([open ?? parsed.lines[0]], pricedForm);
  assert.equal(priced.ok, true);
  if (!priced.ok) return;
  assert.equal(priced.lines[0]?.boxCents, 66500);
  assert.equal(priced.lines[0]?.boxUnitCents, 6650);
  assert.equal(priced.lines[0]?.lineCents, 332500);
  assert.equal(priced.subtotalCents, 332500);
  assert.equal(quoteIsPriced(priced.lines), true);

  const missing = new FormData();
  assert.equal(applyQuotePrices(parsed.lines, missing).ok, false);
  assert.equal(audToCents("665"), 66500);
  assert.equal(audToCents("665.5"), 66550);
  assert.equal(audToCents("0"), null);
  assert.equal(audToCents("665.555"), null);
});

test("empty, fractional, and unknown box quantities are rejected", () => {
  const offers = boxOffers(catalog);
  const empty = new FormData();
  empty.set("box_Dsip15", "0");
  assert.equal(parseQuoteRequest(empty, offers).ok, false);

  const fraction = new FormData();
  fraction.set("box_Dsip15", "1.5");
  const fractional = parseQuoteRequest(fraction, offers);
  assert.equal(fractional.ok, false);
  if (!fractional.ok) assert.equal(fractional.error, "quote");

  const unknown = new FormData();
  unknown.set("box_NOTREAL", "1");
  const missing = parseQuoteRequest(unknown, offers);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "quote");
});

test("applications require a real business, research confirmation, and a separate password", () => {
  const form = new FormData();
  form.set("businessName", "Harbour Research");
  form.set("contactName", "Ada Lovelace");
  form.set("email", "Ada@Example.com");
  form.set("phone", "+61 400 000 000");
  form.set("abn", "12 345 678 901");
  form.set("region", "VIC");
  form.set("website", "https://harbour.example");
  form.set("message", "Laboratory supply for a research group.");
  form.set("password", "research1");
  form.set("ageConfirmed", "on");
  form.set("researchUse", "on");
  const parsed = applicationFromForm(form);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.application.email, "ada@example.com");
  assert.equal(parsed.application.abn, "12345678901");
  assert.equal(parsed.password, "research1");

  form.set("website", "javascript:alert(1)");
  const website = applicationFromForm(form);
  assert.equal(website.ok, false);

  form.set("website", "https://harbour.example");
  form.delete("researchUse");
  const confirm = applicationFromForm(form);
  assert.equal(confirm.ok, false);
  if (!confirm.ok) assert.equal(confirm.error, "confirm");
});

test("quote references are distinct from shop order references", () => {
  const reference = generateDistributionQuoteReference(Uint8Array.from([2, 3, 4, 5, 6, 7]));
  assert.equal(isDistributionQuoteReference(reference), true);
  assert.equal(isOrderReference(reference), false);
  assert.equal(normalizeDistributionQuoteReference(reference.toLowerCase()), reference);
  assert.equal(isDistributionQuoteReference("DQ-OOOOOO"), false);
  assert.equal(distributionPortalNotice("quoted", "<script>"), "Quote saved.");
  assert.equal(
    distributionPortalNotice("quoted", reference),
    `Quote ${reference} is saved at the distributor box prices. It is not a shop order.`,
  );
  assert.equal(distributionAdminNotice("approved", undefined), "Account approved. They can sign in and request box quotes.");
});

test("desk stats keep unpriced requests apart from quotes that have a saved price", () => {
  const stats = distributionDeskStats(
    [{ status: "pending" }, { status: "approved" }, { status: "rejected" }],
    [
      { status: "requested", subtotalCents: 1000 },
      { status: "accepted", subtotalCents: 9000 },
    ],
  );
  assert.deepEqual(stats, {
    pending: 1,
    approved: 1,
    awaitingPrice: 1,
    pricedQuotes: 1,
    pricedCents: 9000,
  });
  const withPrice = distributionDeskStats(
    [],
    [
      { status: "quoted", subtotalCents: 133000 },
      { status: "declined", subtotalCents: 5000 },
    ],
  );
  assert.equal(withPrice.pricedQuotes, 1);
  assert.equal(withPrice.pricedCents, 133000);
  assert.equal(withPrice.awaitingPrice, 0);
  const grouped = groupBoxOffers(
    boxOffers([
      {
        name: "DSIP",
        slug: "dsip",
        variantLabel: "MG",
        variants: [
          { option: "10", price: 95, sku: "Dsip10" },
          { option: "15", price: 110, sku: "Dsip15" },
        ],
      },
    ]),
  );
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.offers.length, 2);
});

test("distribution schema stores approvals and quotes away from shop passwords", () => {
  const file = compact(readFileSync("db/distribution.sql", "utf8"));
  assert.ok(file.includes(compact(CREATE_DISTRIBUTION_ACCOUNTS)));
  assert.ok(file.includes(compact(CREATE_DISTRIBUTION_QUOTES)));
  assert.ok(file.includes(compact(CREATE_DISTRIBUTION_QUOTES_INDEX)));
  assert.equal(file.includes("orders"), false);
  assert.equal(LIST_DISTRIBUTION_ACCOUNTS.includes("password"), false);
  assert.equal(SELECT_DISTRIBUTION_ACCOUNT.includes("password"), false);
});
