import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import {
  BASE_TIER,
  FIRST_ORDER_BONUS_POINTS,
  JOIN_BONUS_POINTS,
  generateMemberCode,
  isClubEmail,
  normalizeClubEmail,
  normalizeMemberCode,
  pointsForOrder,
  tierForSpend,
} from "./club.ts";

export type ClubMember = {
  email: string;
  firstName: string;
  memberCode: string;
  pointsBalance: number;
  lifetimeSpendCents: number;
  firstOrderBonusAt: string | null;
  createdAt: string | null;
};

export type ClubLedgerReason = "join" | "first_order" | "order" | "redeem" | "adjust";

export type ClubLedgerEntry = {
  id: number;
  points: number;
  reason: ClubLedgerReason;
  orderReference: string | null;
  note: string;
  createdAt: string | null;
};

export class ClubUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "ClubUnavailableError";
  }
}

/** Matches db/club.sql. Neon rejects a trailing semicolon on this endpoint. */
export const CREATE_CLUB_MEMBERS = `CREATE TABLE IF NOT EXISTS club_members (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  member_code TEXT NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_spend_cents INTEGER NOT NULL DEFAULT 0,
  first_order_bonus_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

export const CREATE_CLUB_LEDGER = `CREATE TABLE IF NOT EXISTS club_points_ledger (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL REFERENCES club_members(email) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_reference TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

/** Makes awarding idempotent: one `order` and one `redeem` row per reference. */
export const CREATE_CLUB_LEDGER_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS club_points_ledger_order_reason
  ON club_points_ledger (order_reference, reason) WHERE order_reference IS NOT NULL`;

const ISO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

const MEMBER_COLUMNS = [
  "email",
  "first_name",
  "member_code",
  "points_balance",
  "lifetime_spend_cents",
  `to_char(first_order_bonus_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS first_order_bonus_at`,
  `to_char(created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
].join(", ");

const LEDGER_COLUMNS = [
  "id",
  "points",
  "reason",
  "order_reference",
  "note",
  `to_char(created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
].join(", ");

const SELECT_MEMBER = `SELECT ${MEMBER_COLUMNS} FROM club_members WHERE email = $1`;

const INSERT_MEMBER =
  "INSERT INTO club_members (email, first_name, member_code, points_balance) " +
  `VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING ${MEMBER_COLUMNS}`;

const INSERT_LEDGER =
  "INSERT INTO club_points_ledger (email, points, reason, order_reference, note) " +
  "VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id";

const SELECT_LEDGER =
  `SELECT ${LEDGER_COLUMNS} FROM club_points_ledger WHERE email = $1 ORDER BY id DESC LIMIT $2`;

const ADD_POINTS =
  "UPDATE club_members SET points_balance = points_balance + $2, " +
  `lifetime_spend_cents = lifetime_spend_cents + $3 WHERE email = $1 RETURNING ${MEMBER_COLUMNS}`;

/** Conditional so a concurrent redemption can never push a balance negative. */
const SPEND_POINTS =
  "UPDATE club_members SET points_balance = points_balance - $2 " +
  `WHERE email = $1 AND points_balance >= $2 RETURNING ${MEMBER_COLUMNS}`;

const CLAIM_FIRST_ORDER_BONUS =
  "UPDATE club_members SET first_order_bonus_at = now(), points_balance = points_balance + $2 " +
  `WHERE email = $1 AND first_order_bonus_at IS NULL RETURNING ${MEMBER_COLUMNS}`;

const TAG_REDEMPTION =
  "UPDATE club_points_ledger SET order_reference = $2 WHERE id = $1 AND order_reference IS NULL";

const LIST_MEMBERS = `SELECT ${MEMBER_COLUMNS} FROM club_members ORDER BY created_at DESC LIMIT $1`;

export function clubConfigured() {
  return getSql() !== null;
}

export async function ensureClubTables(sql: Sql) {
  await ensureTable(sql, "club_members", CREATE_CLUB_MEMBERS);
  await ensureTable(sql, "club_points_ledger", CREATE_CLUB_LEDGER);
  await ensureTable(sql, "club_points_ledger_order_reason", CREATE_CLUB_LEDGER_INDEX);
}

function readInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readTimestamp(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function readMemberRow(row: unknown): ClubMember | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const email = normalizeClubEmail(readText(record.email));
  if (!email) return null;
  return {
    email,
    firstName: readText(record.first_name),
    memberCode: readText(record.member_code),
    pointsBalance: readInt(record.points_balance),
    lifetimeSpendCents: readInt(record.lifetime_spend_cents),
    firstOrderBonusAt: readTimestamp(record.first_order_bonus_at),
    createdAt: readTimestamp(record.created_at),
  };
}

export function readLedgerRow(row: unknown): ClubLedgerEntry | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  return {
    id: readInt(record.id),
    points: readInt(record.points),
    reason: (readText(record.reason) || "adjust") as ClubLedgerReason,
    orderReference: readText(record.order_reference) || null,
    note: readText(record.note),
    createdAt: readTimestamp(record.created_at),
  };
}

function database(sql: Sql | null) {
  if (!sql) throw new ClubUnavailableError();
  return sql;
}

async function firstMember(sql: Sql, query: string, params: unknown[]) {
  const result = await sql.query(query, params);
  return readMemberRow(rowsOf(result)[0]) ?? null;
}

export async function findMember(
  email: string,
  sql: Sql | null = getSql(),
): Promise<ClubMember | null> {
  const normalized = normalizeClubEmail(email);
  if (!normalized) return null;
  const db = database(sql);
  await ensureClubTables(db);
  return firstMember(db, SELECT_MEMBER, [normalized]);
}

/**
 * Email alone is enough to *earn* points; seeing a balance or spending points
 * needs the member code as well, so one customer can never read or burn
 * another's points by guessing an email address.
 */
export async function authenticateMember(
  email: string,
  code: string,
  sql: Sql | null = getSql(),
): Promise<ClubMember | null> {
  const memberCode = normalizeMemberCode(code);
  if (!memberCode) return null;
  const member = await findMember(email, sql);
  if (!member) return null;
  return normalizeMemberCode(member.memberCode) === memberCode ? member : null;
}

export type JoinResult = { member: ClubMember; created: boolean };

/** Creates the member with the welcome points already on the balance. */
export async function joinClub(
  input: { email: string; firstName?: string },
  sql: Sql | null = getSql(),
  makeCode: () => string = generateMemberCode,
): Promise<JoinResult> {
  const email = normalizeClubEmail(input.email);
  if (!isClubEmail(email)) throw new Error("Enter a valid email address");
  const db = database(sql);
  await ensureClubTables(db);

  const firstName = (input.firstName ?? "").trim().slice(0, 120);
  const created = await firstMember(db, INSERT_MEMBER, [
    email,
    firstName,
    makeCode(),
    JOIN_BONUS_POINTS,
  ]);
  if (!created) {
    const existing = await firstMember(db, SELECT_MEMBER, [email]);
    if (!existing) throw new Error("Could not create the membership");
    return { member: existing, created: false };
  }

  await db.query(INSERT_LEDGER, [email, JOIN_BONUS_POINTS, "join", null, "Welcome points"]);
  return { member: created, created: true };
}

export async function listLedger(
  email: string,
  limit = 20,
  sql: Sql | null = getSql(),
): Promise<ClubLedgerEntry[]> {
  const normalized = normalizeClubEmail(email);
  if (!normalized) return [];
  const db = database(sql);
  await ensureClubTables(db);
  const capped = Math.min(100, Math.max(1, Math.trunc(limit)));
  const result = await db.query(SELECT_LEDGER, [normalized, capped]);
  return rowsOf(result)
    .map(readLedgerRow)
    .filter((entry): entry is ClubLedgerEntry => entry !== null);
}

export type RedemptionHold = {
  ledgerId: number;
  points: number;
  member: ClubMember;
};

/**
 * Takes the points off the balance *before* the order row exists, so a double
 * submit cannot spend the same points twice. The caller tags the ledger row
 * with the order reference on success and calls `releaseRedemption` if the
 * order could not be created.
 */
export async function holdRedemption(
  input: { email: string; points: number },
  sql: Sql | null = getSql(),
): Promise<RedemptionHold | null> {
  const email = normalizeClubEmail(input.email);
  const points = Math.max(0, Math.floor(input.points));
  if (!email || points <= 0) return null;
  const db = database(sql);
  await ensureClubTables(db);

  const member = await firstMember(db, SPEND_POINTS, [email, points]);
  if (!member) return null;

  const result = await db.query(INSERT_LEDGER, [
    email,
    -points,
    "redeem",
    null,
    "Redeemed at checkout",
  ]);
  const ledgerId = readInt((rowsOf(result)[0] as Record<string, unknown> | undefined)?.id);
  return { ledgerId, points, member };
}

export async function tagRedemption(
  hold: RedemptionHold,
  orderReference: string,
  sql: Sql | null = getSql(),
) {
  if (!hold.ledgerId) return;
  await database(sql).query(TAG_REDEMPTION, [hold.ledgerId, orderReference]);
}

/** Puts held points back when the order they were held for was never created. */
export async function releaseRedemption(hold: RedemptionHold, sql: Sql | null = getSql()) {
  const db = database(sql);
  await db.query(ADD_POINTS, [hold.member.email, hold.points, 0]);
  await db.query(INSERT_LEDGER, [
    hold.member.email,
    hold.points,
    "adjust",
    null,
    "Checkout did not complete",
  ]);
}

export type ClubAward = {
  email: string;
  orderPoints: number;
  bonusPoints: number;
  member: ClubMember;
};

/**
 * Called when an order becomes paid. Idempotent: the unique index on
 * (order_reference, reason) means a second mark-paid inserts no ledger row and
 * therefore moves no balance. Points are earned at the tier held *before* this
 * order, which is why the ledger row goes in before the spend is added.
 */
export async function awardOrderPoints(
  input: { email: string; orderReference: string; paidCents: number },
  sql: Sql | null = getSql(),
): Promise<ClubAward | null> {
  const email = normalizeClubEmail(input.email);
  const paidCents = Math.max(0, Math.floor(input.paidCents));
  const reference = (input.orderReference ?? "").trim();
  if (!email || !reference || paidCents <= 0) return null;

  const db = database(sql);
  const member = await findMember(email, db);
  if (!member) return null;

  const tier = tierForSpend(member.lifetimeSpendCents) ?? BASE_TIER;
  const orderPoints = pointsForOrder(paidCents, tier);

  const inserted = await db.query(INSERT_LEDGER, [
    email,
    orderPoints,
    "order",
    reference,
    `${tier.name} earn rate`,
  ]);
  if (rowsOf(inserted).length === 0) return null;

  let updated = (await firstMember(db, ADD_POINTS, [email, orderPoints, paidCents])) ?? member;

  let bonusPoints = 0;
  const claimed = await firstMember(db, CLAIM_FIRST_ORDER_BONUS, [
    email,
    FIRST_ORDER_BONUS_POINTS,
  ]);
  if (claimed) {
    bonusPoints = FIRST_ORDER_BONUS_POINTS;
    updated = claimed;
    await db.query(INSERT_LEDGER, [
      email,
      FIRST_ORDER_BONUS_POINTS,
      "first_order",
      reference,
      "First order bonus",
    ]);
  }

  return { email, orderPoints, bonusPoints, member: updated };
}

/** Manual correction from the admin API. Positive adds, negative removes. */
export async function adjustPoints(
  input: { email: string; points: number; note?: string },
  sql: Sql | null = getSql(),
): Promise<ClubMember | null> {
  const email = normalizeClubEmail(input.email);
  const points = Math.trunc(input.points);
  if (!email || !Number.isFinite(points) || points === 0) return null;
  const db = database(sql);
  await ensureClubTables(db);

  const note = (input.note ?? "Manual adjustment").trim().slice(0, 200);
  const member =
    points > 0
      ? await firstMember(db, ADD_POINTS, [email, points, 0])
      : await firstMember(db, SPEND_POINTS, [email, -points]);
  if (!member) return null;
  await db.query(INSERT_LEDGER, [email, points, "adjust", null, note]);
  return member;
}

export async function listMembers(
  limit = 50,
  sql: Sql | null = getSql(),
): Promise<ClubMember[]> {
  const db = database(sql);
  await ensureClubTables(db);
  const capped = Math.min(200, Math.max(1, Math.trunc(limit)));
  const result = await db.query(LIST_MEMBERS, [capped]);
  return rowsOf(result)
    .map(readMemberRow)
    .filter((member): member is ClubMember => member !== null);
}
