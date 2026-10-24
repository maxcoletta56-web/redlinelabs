import assert from "node:assert/strict";
import test from "node:test";
import { hashDistributionPassword } from "./distribution-auth.ts";
import {
  authenticateDistributionAccount,
  createDistributionAccount,
  createDistributionQuote,
  distributionConfigured,
  DistributionForbiddenError,
  listDistributionAccounts,
  listDistributionQuotes,
  reviewDistributionAccount,
  reviewDistributionQuote,
  saveDistributionQuotePrices,
} from "./distribution-db.ts";
import { createDistributionMemorySql, distributionDevStoreEnabled } from "./distribution-memory.ts";
import type { DistributionApplication, DistributionQuoteLine } from "./distribution.ts";

const APPLICATION: DistributionApplication = {
  businessName: "Harbour Research",
  contactName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+61 400 000 000",
  abn: "12345678901",
  region: "VIC",
  website: "https://harbour.example",
  message: "Laboratory supply.",
};

function createFakeSql() {
  return createDistributionMemorySql();
}

test("the development store cannot turn on in production or by default", () => {
  assert.equal(distributionDevStoreEnabled({ NODE_ENV: "development" }), false);
  assert.equal(
    distributionDevStoreEnabled({ NODE_ENV: "production", DISTRIBUTION_DEV_STORE: "1" }),
    false,
  );
  assert.equal(
    distributionDevStoreEnabled({ NODE_ENV: "development", DISTRIBUTION_DEV_STORE: "1" }),
    true,
  );
  assert.equal(distributionConfigured(), false);
});

const LINE: DistributionQuoteLine = {
  slug: "dsip",
  name: "DSIP",
  sku: "Dsip10",
  option: "10 MG",
  boxes: 2,
  unitsPerBox: 10,
  retailUnitCents: 9500,
  boxCents: 0,
  boxUnitCents: 0,
  lineCents: 0,
};

const PRICED_LINE: DistributionQuoteLine = {
  ...LINE,
  boxCents: 66500,
  boxUnitCents: 6650,
  lineCents: 133000,
};

test("an application stays pending and a repeat email does not replace the password", async () => {
  const db = createFakeSql();
  const password = await hashDistributionPassword("research1");
  const created = await createDistributionAccount(APPLICATION, password.hash, password.salt, db.sql);
  assert.equal(created.created, true);
  assert.equal(created.account?.status, "pending");
  assert.equal(created.account?.email, "ada@example.com");
  assert.equal(JSON.stringify(db.accounts).includes("research1"), false);

  const again = await createDistributionAccount(
    APPLICATION,
    "different-hash",
    "different-salt",
    db.sql,
  );
  assert.equal(again.created, false);
  assert.equal(db.accounts[0]?.password_hash, password.hash);
  assert.equal((await listDistributionAccounts(db.sql)).length, 1);
});

test("box quotes stay unpriced until the desk saves a price, and a declined quote cannot be repriced", async () => {
  const db = createFakeSql();
  const password = await hashDistributionPassword("research1");
  const created = await createDistributionAccount(APPLICATION, password.hash, password.salt, db.sql);
  const id = created.account?.id ?? "";
  await assert.rejects(
    () => createDistributionQuote(id, [LINE], "First order", 0, db.sql),
    DistributionForbiddenError,
  );

  const approved = await reviewDistributionAccount(id, "approved", "Welcome", db.sql);
  assert.equal(approved?.status, "approved");
  assert.equal(approved?.reviewNote, "Welcome");

  const quote = await createDistributionQuote(id, [LINE], "First order", 0, db.sql);
  assert.match(quote.reference, /^DQ-[2-9A-HJKLMNP-Z]{6}$/);
  assert.equal(quote.status, "requested");
  assert.equal(quote.subtotalCents, 0);
  assert.equal(quote.lines[0]?.boxCents, 0);
  assert.equal(quote.email, "ada@example.com");
  assert.equal(quote.businessName, "Harbour Research");
  assert.equal(await saveDistributionQuotePrices(quote.reference, [LINE], 0, db.sql), null);

  const priced = await saveDistributionQuotePrices(quote.reference, [PRICED_LINE], 133000, db.sql);
  assert.equal(priced?.status, "quoted");
  assert.equal(priced?.subtotalCents, 133000);
  assert.equal(priced?.lines[0]?.boxCents, 66500);
  assert.equal(priced?.lines[0]?.boxUnitCents, 6650);
  assert.equal(priced?.email, "ada@example.com");

  const revised = await saveDistributionQuotePrices(
    quote.reference,
    [{ ...PRICED_LINE, boxCents: 70000, boxUnitCents: 7000, lineCents: 140000 }],
    140000,
    db.sql,
  );
  assert.equal(revised?.status, "quoted");
  assert.equal(revised?.subtotalCents, 140000);

  const listed = await listDistributionQuotes(db.sql);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.reference, quote.reference);
  assert.equal(listed[0]?.subtotalCents, 140000);

  const accepted = await reviewDistributionQuote(quote.reference, "accepted", "Proceed", db.sql);
  assert.equal(accepted?.status, "accepted");
  const repriced = await saveDistributionQuotePrices(quote.reference, [PRICED_LINE], 133000, db.sql);
  assert.equal(repriced?.status, "accepted");
  assert.equal(repriced?.subtotalCents, 133000);

  const declined = await reviewDistributionQuote(quote.reference, "declined", "Out of stock", db.sql);
  assert.equal(declined?.status, "declined");
  assert.equal(declined?.adminNote, "Out of stock");
  assert.equal(declined?.email, "ada@example.com");
  assert.equal(await saveDistributionQuotePrices(quote.reference, [PRICED_LINE], 133000, db.sql), null);
  assert.equal((await listDistributionQuotes(db.sql))[0]?.subtotalCents, 133000);

  const signedIn = await authenticateDistributionAccount("Ada@Example.com", "research1", db.sql);
  assert.equal(signedIn?.id, id);
  assert.equal(await authenticateDistributionAccount("ada@example.com", "nope", db.sql), null);
  assert.equal(await authenticateDistributionAccount("missing@example.com", "research1", db.sql), null);
});
