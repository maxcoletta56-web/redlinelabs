import assert from "node:assert/strict";
import test from "node:test";
import { RESEARCH_DISCLAIMER } from "./company.ts";
import type { DistributionQuote } from "./distribution-db.ts";
import {
  buildDistributionApplicationEmails,
  buildDistributionDecisionEmail,
  buildDistributionQuoteEmails,
  buildDistributionQuotePricedEmail,
} from "./distribution-mail.ts";

const ENV = {
  ORDER_NOTIFY_EMAIL: "desk@example.com",
  NEXT_PUBLIC_SITE_URL: "https://redlinelabs.shop",
};

test("application mail tells the merchant who applied and keeps the password out", () => {
  const messages = buildDistributionApplicationEmails(
    {
      businessName: "Harbour Research",
      contactName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+61 400 000 000",
      abn: "12345678901",
      region: "VIC",
      website: "https://harbour.example",
      message: "Laboratory supply.",
    },
    ENV,
  );
  assert.equal(messages.applicant.to, "ada@example.com");
  assert.match(messages.applicant.text, /Box prices stay hidden/);
  assert.match(messages.applicant.text, new RegExp(RESEARCH_DISCLAIMER));
  assert.equal(messages.merchant.to, "desk@example.com");
  assert.match(messages.merchant.text, /Harbour Research/);
  assert.match(messages.merchant.text, /ada@example.com/);
  assert.match(messages.merchant.text, /\/admin\/distribution/);
  assert.equal(messages.merchant.text.includes("password"), false);
  assert.equal(messages.applicant.text.includes("password"), false);
});

test("approval mail points at the distribution login and quote mail is not a shop order", () => {
  const decision = buildDistributionDecisionEmail(
    {
      contactName: "Ada Lovelace",
      email: "ada@example.com",
      businessName: "Harbour Research",
      status: "approved",
      reviewNote: "",
    },
    ENV,
  );
  assert.match(decision.text, /10% off that item, not off the order total/);
  assert.match(decision.text, /at least 5 boxes/);
  assert.equal(decision.text.includes("30%"), false);
  assert.match(decision.text, /https:\/\/redlinelabs.shop\/distribution/);
  assert.equal(decision.text.includes("/shop"), false);

  const quote: DistributionQuote = {
    reference: "DQ-234567",
    accountId: "account",
    status: "requested",
    lines: [
      {
        slug: "dsip",
        name: "DSIP",
        sku: "Dsip10",
        option: "10 MG",
        boxes: 1,
        unitsPerBox: 10,
        retailUnitCents: 9500,
        boxCents: 0,
        boxUnitCents: 0,
        lineCents: 0,
      },
    ],
    note: "",
    adminNote: "",
    subtotalCents: 0,
    createdAt: null,
    updatedAt: null,
    businessName: "Harbour Research",
    contactName: "Ada Lovelace",
    email: "ada@example.com",
  };
  const messages = buildDistributionQuoteEmails(quote, ENV);
  assert.match(messages.applicant.text, /not a shop order/);
  assert.match(messages.applicant.text, /box price not set yet/);
  assert.equal(messages.applicant.text.includes("$0.00"), false);
  assert.match(messages.merchant.text, /DQ-234567/);
  assert.match(messages.merchant.subject, /DQ-234567/);

  const line = quote.lines[0];
  if (!line) throw new Error("missing quote line");
  const priced = buildDistributionQuotePricedEmail(
    {
      ...quote,
      status: "quoted",
      lines: [{ ...line, boxCents: 66500, boxUnitCents: 6650, lineCents: 66500 }],
      subtotalCents: 66500,
    },
    ENV,
  );
  assert.match(priced.text, /\$665\.00/);
  assert.match(priced.text, /not a shop order/);
  assert.match(priced.subject, /DQ-234567 priced/);
});
