import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import { verifyDistributionPassword } from "./distribution-auth.ts";
import { distributionDevStoreEnabled, distributionDevStoreSql } from "./distribution-memory.ts";
import {
  DISTRIBUTION_ACCOUNT_STATUSES,
  DISTRIBUTION_QUOTE_STATUSES,
  generateDistributionQuoteReference,
  normalizeDistributionQuoteReference,
  quoteIsPriced,
  type DistributionAccountStatus,
  type DistributionApplication,
  type DistributionQuoteLine,
  type DistributionQuoteStatus,
} from "./distribution.ts";
import { normalizeEmail } from "./account-data.ts";

export class DistributionUnavailableError extends Error {
  constructor(message = "DATABASE_URL is not set") {
    super(message);
    this.name = "DistributionUnavailableError";
  }
}

export class DistributionForbiddenError extends Error {
  constructor(message = "Distribution account is not approved") {
    super(message);
    this.name = "DistributionForbiddenError";
  }
}

export type DistributionAccount = {
  id: string;
  email: string;
  businessName: string;
  contactName: string;
  phone: string;
  abn: string;
  region: string;
  website: string;
  message: string;
  status: DistributionAccountStatus;
  reviewNote: string;
  createdAt: string | null;
  reviewedAt: string | null;
};

export type DistributionQuote = {
  reference: string;
  accountId: string;
  status: DistributionQuoteStatus;
  lines: DistributionQuoteLine[];
  note: string;
  adminNote: string;
  subtotalCents: number;
  createdAt: string | null;
  updatedAt: string | null;
  businessName: string;
  contactName: string;
  email: string;
};

const ACCOUNT_COLUMNS =
  "id, email, business_name, contact_name, phone, abn, region, website, message, status, review_note, created_at, reviewed_at";

export const CREATE_DISTRIBUTION_ACCOUNTS = `CREATE TABLE IF NOT EXISTS distribution_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  abn TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
)`;

export const CREATE_DISTRIBUTION_QUOTES = `CREATE TABLE IF NOT EXISTS distribution_quotes (
  reference TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES distribution_accounts(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'quoted', 'accepted', 'declined')),
  lines JSONB NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export const CREATE_DISTRIBUTION_QUOTES_INDEX =
  "CREATE INDEX IF NOT EXISTS distribution_quotes_account_created_idx ON distribution_quotes (account_id, created_at DESC)";

export const INSERT_DISTRIBUTION_ACCOUNT =
  "INSERT INTO distribution_accounts (" +
  "id, email, password_hash, password_salt, business_name, contact_name, phone, abn, region, website, message" +
  ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) " +
  "ON CONFLICT (email) DO NOTHING " +
  `RETURNING ${ACCOUNT_COLUMNS}`;

export const SELECT_DISTRIBUTION_LOGIN =
  "SELECT id, email, password_hash, password_salt, status FROM distribution_accounts WHERE email = $1";

export const SELECT_DISTRIBUTION_ACCOUNT =
  `SELECT ${ACCOUNT_COLUMNS} FROM distribution_accounts WHERE id = $1`;

export const LIST_DISTRIBUTION_ACCOUNTS =
  `SELECT ${ACCOUNT_COLUMNS} FROM distribution_accounts ORDER BY created_at DESC LIMIT 200`;

export const UPDATE_DISTRIBUTION_ACCOUNT =
  "UPDATE distribution_accounts SET status = $2, review_note = $3, reviewed_at = now() " +
  `WHERE id = $1 RETURNING ${ACCOUNT_COLUMNS}`;

export const INSERT_DISTRIBUTION_QUOTE =
  "INSERT INTO distribution_quotes (reference, account_id, lines, note, subtotal_cents, status) " +
  "VALUES ($1, $2, $3::jsonb, $4, $5, $6) " +
  "RETURNING reference, account_id, status, lines, note, admin_note, subtotal_cents, created_at, updated_at";

export const LIST_ACCOUNT_DISTRIBUTION_QUOTES =
  "SELECT reference, account_id, status, lines, note, admin_note, subtotal_cents, created_at, updated_at " +
  "FROM distribution_quotes WHERE account_id = $1 ORDER BY created_at DESC LIMIT 50";

export const LIST_DISTRIBUTION_QUOTES =
  "SELECT q.reference, q.account_id, q.status, q.lines, q.note, q.admin_note, q.subtotal_cents, " +
  "q.created_at, q.updated_at, a.business_name, a.contact_name, a.email " +
  "FROM distribution_quotes q JOIN distribution_accounts a ON a.id = q.account_id " +
  "ORDER BY q.created_at DESC LIMIT 200";

export const UPDATE_DISTRIBUTION_QUOTE =
  "UPDATE distribution_quotes SET status = $2, admin_note = $3, updated_at = now() " +
  "WHERE reference = $1 " +
  "RETURNING reference, account_id, status, lines, note, admin_note, subtotal_cents, created_at, updated_at";

export const UPDATE_DISTRIBUTION_QUOTE_PRICES =
  "UPDATE distribution_quotes SET lines = $2::jsonb, subtotal_cents = $3, updated_at = now(), " +
  "status = CASE WHEN status = 'requested' THEN 'quoted' ELSE status END " +
  "WHERE reference = $1 AND status <> 'declined' " +
  "RETURNING reference, account_id, status, lines, note, admin_note, subtotal_cents, created_at, updated_at";

const DUMMY_SALT = "00".repeat(16);
const DUMMY_HASH = "11".repeat(32);

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readTimestamp(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function readInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function readJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readAccountStatus(value: unknown): DistributionAccountStatus {
  const status = readText(value);
  return (DISTRIBUTION_ACCOUNT_STATUSES as readonly string[]).includes(status)
    ? (status as DistributionAccountStatus)
    : "pending";
}

function readQuoteStatus(value: unknown): DistributionQuoteStatus {
  const status = readText(value);
  return (DISTRIBUTION_QUOTE_STATUSES as readonly string[]).includes(status)
    ? (status as DistributionQuoteStatus)
    : "requested";
}

function readLines(value: unknown): DistributionQuoteLine[] {
  const parsed = readJson(value);
  if (!Array.isArray(parsed)) return [];
  const lines: DistributionQuoteLine[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const boxes = readInt(row.boxes);
    const unitsPerBox = readInt(row.unitsPerBox);
    const retailUnitCents = readInt(row.retailUnitCents);
    const storedBox = readInt(row.boxCents);
    const unit = readInt(row.boxUnitCents);
    const boxCents = storedBox > 0 ? storedBox : unit * unitsPerBox;
    const lineCents = readInt(row.lineCents);
    if (boxes < 1 || unitsPerBox < 1 || unit < 0 || lineCents < 0 || boxCents < 0) continue;
    lines.push({
      slug: readText(row.slug),
      name: readText(row.name) || "Research listing",
      sku: readText(row.sku),
      option: readText(row.option),
      boxes,
      unitsPerBox,
      retailUnitCents,
      boxCents,
      boxUnitCents: unit > 0 ? unit : Math.round(boxCents / unitsPerBox),
      lineCents: lineCents > 0 ? lineCents : boxCents * boxes,
    });
  }
  return lines;
}

export function readDistributionAccountRow(row: unknown): DistributionAccount | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = readText(record.id);
  const email = normalizeEmail(readText(record.email));
  if (!id || !email) return null;
  return {
    id,
    email,
    businessName: readText(record.business_name),
    contactName: readText(record.contact_name),
    phone: readText(record.phone),
    abn: readText(record.abn),
    region: readText(record.region),
    website: readText(record.website),
    message: readText(record.message),
    status: readAccountStatus(record.status),
    reviewNote: readText(record.review_note),
    createdAt: readTimestamp(record.created_at),
    reviewedAt: readTimestamp(record.reviewed_at),
  };
}

export function readDistributionQuoteRow(row: unknown): DistributionQuote | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const reference = normalizeDistributionQuoteReference(readText(record.reference));
  const accountId = readText(record.account_id);
  if (!reference || !accountId) return null;
  return {
    reference,
    accountId,
    status: readQuoteStatus(record.status),
    lines: readLines(record.lines),
    note: readText(record.note),
    adminNote: readText(record.admin_note),
    subtotalCents: Math.max(0, readInt(record.subtotal_cents)),
    createdAt: readTimestamp(record.created_at),
    updatedAt: readTimestamp(record.updated_at),
    businessName: readText(record.business_name),
    contactName: readText(record.contact_name),
    email: normalizeEmail(readText(record.email)),
  };
}

async function ready(sql: Sql) {
  await ensureTable(sql, "distribution_accounts", CREATE_DISTRIBUTION_ACCOUNTS);
  await ensureTable(sql, "distribution_quotes", CREATE_DISTRIBUTION_QUOTES);
  await ensureTable(sql, "distribution_quotes_account_created_idx", CREATE_DISTRIBUTION_QUOTES_INDEX);
}

function database(sql?: Sql) {
  if (sql) return sql;
  const resolved = getSql();
  if (resolved) return resolved;
  if (distributionDevStoreEnabled()) return distributionDevStoreSql();
  throw new DistributionUnavailableError();
}

export function distributionConfigured() {
  return getSql() !== null || distributionDevStoreEnabled();
}

export async function createDistributionAccount(
  application: DistributionApplication,
  passwordHash: string,
  passwordSalt: string,
  sql?: Sql,
) {
  const db = database(sql);
  await ready(db);
  const id = crypto.randomUUID();
  const rows = rowsOf(
    await db.query(INSERT_DISTRIBUTION_ACCOUNT, [
      id,
      application.email,
      passwordHash,
      passwordSalt,
      application.businessName,
      application.contactName,
      application.phone,
      application.abn,
      application.region,
      application.website,
      application.message,
    ]),
  );
  const account = readDistributionAccountRow(rows[0]);
  if (!account) return { created: false as const, account: null };
  return { created: true as const, account };
}

type LoginRow = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
};

function readLoginRow(row: unknown): LoginRow | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const id = readText(record.id);
  const email = normalizeEmail(readText(record.email));
  const passwordHash = readText(record.password_hash);
  const passwordSalt = readText(record.password_salt);
  if (!id || !email || !passwordHash || !passwordSalt) return null;
  return { id, email, passwordHash, passwordSalt };
}

export async function authenticateDistributionAccount(email: string, password: string, sql?: Sql) {
  const db = database(sql);
  await ready(db);
  const rows = rowsOf(await db.query(SELECT_DISTRIBUTION_LOGIN, [normalizeEmail(email)]));
  const login = readLoginRow(rows[0]);
  const matches = await verifyDistributionPassword(
    password,
    login?.passwordSalt ?? DUMMY_SALT,
    login?.passwordHash ?? DUMMY_HASH,
  );
  if (!login || !matches) return null;
  return findDistributionAccount(login.id, db);
}

export async function findDistributionAccount(id: string, sql?: Sql) {
  const db = database(sql);
  await ready(db);
  const rows = rowsOf(await db.query(SELECT_DISTRIBUTION_ACCOUNT, [id]));
  return readDistributionAccountRow(rows[0]);
}

export async function listDistributionAccounts(sql?: Sql) {
  const db = database(sql);
  await ready(db);
  return rowsOf(await db.query(LIST_DISTRIBUTION_ACCOUNTS)).flatMap((row) => {
    const account = readDistributionAccountRow(row);
    return account ? [account] : [];
  });
}

export async function reviewDistributionAccount(
  id: string,
  status: DistributionAccountStatus,
  reviewNote: string,
  sql?: Sql,
) {
  if (!(DISTRIBUTION_ACCOUNT_STATUSES as readonly string[]).includes(status)) return null;
  const db = database(sql);
  await ready(db);
  const rows = rowsOf(await db.query(UPDATE_DISTRIBUTION_ACCOUNT, [id, status, reviewNote]));
  return readDistributionAccountRow(rows[0]);
}

function isUniqueViolation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("23505") || /duplicate key/i.test(message);
}

export async function createDistributionQuote(
  accountId: string,
  lines: DistributionQuoteLine[],
  note: string,
  subtotalCents: number,
  sql?: Sql,
) {
  const db = database(sql);
  await ready(db);
  const account = await findDistributionAccount(accountId, db);
  if (!account || account.status !== "approved") throw new DistributionForbiddenError();
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
    throw new Error("Quote total must be whole cents");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = generateDistributionQuoteReference();
    try {
      const rows = rowsOf(
        await db.query(INSERT_DISTRIBUTION_QUOTE, [
          reference,
          accountId,
          JSON.stringify(lines),
          note,
          subtotalCents,
          quoteIsPriced(lines) ? "quoted" : "requested",
        ]),
      );
      const quote = readDistributionQuoteRow(rows[0]);
      if (!quote) throw new Error("Quote insert did not return a row");
      return { ...quote, businessName: account.businessName, contactName: account.contactName, email: account.email };
    } catch (error) {
      lastError = error;
      if (!isUniqueViolation(error) || attempt === 2) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not allocate a quote reference");
}

export async function listAccountDistributionQuotes(accountId: string, sql?: Sql) {
  const db = database(sql);
  await ready(db);
  return rowsOf(await db.query(LIST_ACCOUNT_DISTRIBUTION_QUOTES, [accountId])).flatMap((row) => {
    const quote = readDistributionQuoteRow(row);
    return quote ? [quote] : [];
  });
}

export async function listDistributionQuotes(sql?: Sql) {
  const db = database(sql);
  await ready(db);
  return rowsOf(await db.query(LIST_DISTRIBUTION_QUOTES)).flatMap((row) => {
    const quote = readDistributionQuoteRow(row);
    return quote ? [quote] : [];
  });
}

export async function reviewDistributionQuote(
  reference: string,
  status: DistributionQuoteStatus,
  adminNote: string,
  sql?: Sql,
) {
  const normalized = normalizeDistributionQuoteReference(reference);
  if (!normalized) return null;
  if (!(DISTRIBUTION_QUOTE_STATUSES as readonly string[]).includes(status)) return null;
  const db = database(sql);
  await ready(db);
  const rows = rowsOf(await db.query(UPDATE_DISTRIBUTION_QUOTE, [normalized, status, adminNote]));
  const quote = readDistributionQuoteRow(rows[0]);
  if (!quote) return null;
  const account = await findDistributionAccount(quote.accountId, db);
  return {
    ...quote,
    businessName: account?.businessName ?? quote.businessName,
    contactName: account?.contactName ?? quote.contactName,
    email: account?.email ?? quote.email,
  };
}

export async function saveDistributionQuotePrices(
  reference: string,
  lines: DistributionQuoteLine[],
  subtotalCents: number,
  sql?: Sql,
) {
  const normalized = normalizeDistributionQuoteReference(reference);
  if (!normalized || !quoteIsPriced(lines)) return null;
  const summed = lines.reduce((sum, line) => sum + line.lineCents, 0);
  if (!Number.isInteger(subtotalCents) || subtotalCents !== summed) return null;
  const db = database(sql);
  await ready(db);
  const rows = rowsOf(
    await db.query(UPDATE_DISTRIBUTION_QUOTE_PRICES, [normalized, JSON.stringify(lines), subtotalCents]),
  );
  const quote = readDistributionQuoteRow(rows[0]);
  if (!quote) return null;
  const account = await findDistributionAccount(quote.accountId, db);
  return {
    ...quote,
    businessName: account?.businessName ?? quote.businessName,
    contactName: account?.contactName ?? quote.contactName,
    email: account?.email ?? quote.email,
  };
}
