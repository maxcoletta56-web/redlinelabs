import { createHmac } from "node:crypto";
import { ensureTable, getSql, rowsOf, type Sql } from "./db.ts";
import {
  activeClubProgram,
  generateMemberCode,
  isClubEmail,
  normalizeClubEmail,
  normalizeMemberCode,
  pointsForOrder,
  tierForSpend,
  type ActiveClubProgram,
} from "./club.ts";

export type ClubMember = {
  email: string;
  firstName: string;
  pointsBalance: number;
  lifetimeSpendCents: number;
  createdAt: string | null;
};

/** `redeem` reserves points for an order, `redeem_release` gives them back. */
export type ClubLedgerReason =
  | "order"
  | "redeem"
  | "redeem_release"
  | "adjust"
  | "join"
  | "first_order";

export type ClubLedgerEntry = {
  id: number;
  points: number;
  reason: ClubLedgerReason;
  orderReference: string | null;
  note: string;
  createdAt: string | null;
};

export class ClubUnavailableError extends Error {
  constructor(message = "DATABASE_URL is not set") {
    super(message);
    this.name = "ClubUnavailableError";
  }
}

const MIN_SECRET_LENGTH = 32;

/**
 * Member codes are stored only as an HMAC under this server secret. The codes
 * are random and long, but the secret means a leaked database alone still
 * cannot be used to test guesses offline.
 */
export function clubCodeSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env.CLUB_CODE_SECRET?.trim() ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new ClubUnavailableError(`CLUB_CODE_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

/** Hex HMAC-SHA256 of the normalised code, or `null` if the input is not a valid code. */
export function hashMemberCode(code: string, secret: string = clubCodeSecret()) {
  const normalized = normalizeMemberCode(code);
  if (!normalized) return null;
  return createHmac("sha256", secret).update(normalized).digest("hex");
}

/** Matches db/club.sql. Neon rejects a trailing semicolon on this endpoint. */
export const CREATE_CLUB_MEMBERS = `CREATE TABLE IF NOT EXISTS club_members (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  member_code TEXT,
  member_code_hash TEXT,
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

/**
 * Makes every per-order movement idempotent in the database itself: one
 * `order`, one `redeem` and one `redeem_release` row per order reference.
 */
export const CREATE_CLUB_LEDGER_INDEX = `CREATE UNIQUE INDEX IF NOT EXISTS club_points_ledger_order_reason
  ON club_points_ledger (order_reference, reason) WHERE order_reference IS NOT NULL`;

const ISO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

function memberColumns(alias = "") {
  const p = alias ? `${alias}.` : "";
  return [
    `${p}email AS email`,
    `${p}first_name AS first_name`,
    `${p}points_balance AS points_balance`,
    `${p}lifetime_spend_cents AS lifetime_spend_cents`,
    `to_char(${p}created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
  ].join(", ");
}

const LEDGER_COLUMNS = [
  "id",
  "points",
  "reason",
  "order_reference",
  "note",
  `to_char(created_at AT TIME ZONE 'UTC', ${ISO_UTC}) AS created_at`,
].join(", ");

export const SELECT_MEMBER = `SELECT ${memberColumns()} FROM club_members WHERE email = $1`;

export const SELECT_MEMBER_WITH_CODE = `${SELECT_MEMBER} AND member_code_hash = $2`;

export const INSERT_MEMBER =
  "INSERT INTO club_members (email, first_name, member_code_hash) VALUES ($1, $2, $3) " +
  `ON CONFLICT DO NOTHING RETURNING ${memberColumns()}`;

export const SELECT_LEDGER = `SELECT ${LEDGER_COLUMNS} FROM club_points_ledger WHERE email = $1 ORDER BY id DESC LIMIT $2`;

const LIST_MEMBERS = `SELECT ${memberColumns()} FROM club_members ORDER BY created_at DESC LIMIT $1`;

/**
 * One statement, so the ledger row, the balance and the lifetime spend commit
 * together or not at all. The ledger insert goes first and is guarded by the
 * unique index: a repeat for the same order inserts nothing, so the UPDATE
 * (which reads from the inserted row) touches nothing either.
 */
export const AWARD_ORDER_POINTS =
  "WITH ins AS (" +
  "INSERT INTO club_points_ledger (email, points, reason, order_reference, note) " +
  "SELECT email, $2::integer, 'order', $3::text, $4::text FROM club_members WHERE email = $1 " +
  "ON CONFLICT DO NOTHING RETURNING email, points) " +
  "UPDATE club_members m SET points_balance = m.points_balance + ins.points, " +
  "lifetime_spend_cents = m.lifetime_spend_cents + $5::integer " +
  `FROM ins WHERE m.email = ins.email RETURNING ${memberColumns("m")}`;

/**
 * Reserves points for one order. `FOR UPDATE` makes a concurrent reservation
 * for the same member wait, then re-check the balance against the committed
 * value, so two checkouts can never spend the same points. The unique index
 * makes a repeat for the same order a no-op.
 */
export const RESERVE_POINTS =
  "WITH locked AS (" +
  "SELECT email FROM club_members WHERE email = $1 AND points_balance >= $2::integer FOR UPDATE), " +
  "ins AS (" +
  "INSERT INTO club_points_ledger (email, points, reason, order_reference, note) " +
  "SELECT email, -$2::integer, 'redeem', $3::text, $4::text FROM locked " +
  "ON CONFLICT DO NOTHING RETURNING email, points) " +
  "UPDATE club_members m SET points_balance = m.points_balance + ins.points " +
  `FROM ins WHERE m.email = ins.email RETURNING ${memberColumns("m")}`;

/** Gives a reservation back exactly once, whatever number of times it is asked. */
export const RELEASE_POINTS =
  "WITH ins AS (" +
  "INSERT INTO club_points_ledger (email, points, reason, order_reference, note) " +
  "SELECT email, -points, 'redeem_release', order_reference, $2::text FROM club_points_ledger " +
  "WHERE order_reference = $1 AND reason = 'redeem' " +
  "ON CONFLICT DO NOTHING RETURNING email, points) " +
  "UPDATE club_members m SET points_balance = m.points_balance + ins.points " +
  `FROM ins WHERE m.email = ins.email RETURNING ${memberColumns("m")}`;

export const SELECT_RESERVATION =
  "SELECT points FROM club_points_ledger WHERE order_reference = $1 AND reason = 'redeem'";

export const ADJUST_POINTS =
  "WITH locked AS (" +
  "SELECT email FROM club_members WHERE email = $1 AND points_balance + $2::integer >= 0 FOR UPDATE), " +
  "ins AS (" +
  "INSERT INTO club_points_ledger (email, points, reason, order_reference, note) " +
  "SELECT email, $2::integer, 'adjust', NULL, $3::text FROM locked RETURNING email, points) " +
  "UPDATE club_members m SET points_balance = m.points_balance + ins.points " +
  `FROM ins WHERE m.email = ins.email RETURNING ${memberColumns("m")}`;

/** Paid orders for members that have no `order` ledger row: failed or missed awards. */
export const LIST_UNAWARDED_ORDERS =
  "SELECT o.reference AS reference, o.email AS email, o.total_cents AS total_cents " +
  "FROM orders o JOIN club_members m ON m.email = o.email " +
  "WHERE o.status = 'paid' AND o.paid_at >= GREATEST(m.created_at, $1::timestamptz) " +
  "AND NOT EXISTS (SELECT 1 FROM club_points_ledger l " +
  "WHERE l.order_reference = o.reference AND l.reason = 'order') " +
  "ORDER BY o.paid_at ASC, o.reference ASC LIMIT $2";

/** Cancelled orders whose reserved points were never given back. */
export const LIST_UNRELEASED_ORDERS =
  "SELECT o.reference AS reference FROM orders o " +
  "WHERE o.status = 'cancelled' AND o.club_points_redeemed > 0 " +
  "AND EXISTS (SELECT 1 FROM club_points_ledger r " +
  "WHERE r.order_reference = o.reference AND r.reason = 'redeem') " +
  "AND NOT EXISTS (SELECT 1 FROM club_points_ledger l " +
  "WHERE l.order_reference = o.reference AND l.reason = 'redeem_release') " +
  "ORDER BY o.created_at ASC LIMIT $1";

/**
 * Reservations whose order row was never written (the process died between the
 * reservation and the insert). The grace period keeps a checkout that is still
 * in flight from being released under its own feet.
 */
export const LIST_ORPHAN_RESERVATIONS =
  "SELECT r.order_reference AS reference FROM club_points_ledger r " +
  "WHERE r.reason = 'redeem' AND r.order_reference IS NOT NULL " +
  "AND r.created_at < now() - interval '1 hour' " +
  "AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.reference = r.order_reference) " +
  "AND NOT EXISTS (SELECT 1 FROM club_points_ledger l " +
  "WHERE l.order_reference = r.order_reference AND l.reason = 'redeem_release') " +
  "ORDER BY r.id ASC LIMIT $1";

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
    pointsBalance: readInt(record.points_balance),
    lifetimeSpendCents: readInt(record.lifetime_spend_cents),
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
 * needs the member code as well. Wrong email, unknown email and wrong code are
 * indistinguishable to the caller: all return `null`.
 */
export async function authenticateMember(
  email: string,
  code: string,
  sql: Sql | null = getSql(),
  secret?: string,
): Promise<ClubMember | null> {
  const normalized = normalizeClubEmail(email);
  const hash = hashMemberCode(code, secret);
  if (!normalized || !hash) return null;
  const db = database(sql);
  await ensureClubTables(db);
  return firstMember(db, SELECT_MEMBER_WITH_CODE, [normalized, hash]);
}

export type JoinResult =
  | { created: true; member: ClubMember; memberCode: string }
  | { created: false; member: ClubMember; memberCode: null };

const JOIN_ATTEMPTS = 5;

/**
 * Creates the member and returns the plaintext code exactly once; only its
 * hash is stored. An existing email never gets a code back and never has its
 * code replaced, because the insert is a no-op for it.
 */
export async function joinClub(
  input: { email: string; firstName?: string },
  sql: Sql | null = getSql(),
  makeCode: () => string = generateMemberCode,
  secret?: string,
): Promise<JoinResult> {
  const email = normalizeClubEmail(input.email);
  if (!isClubEmail(email)) throw new Error("Enter a valid email address");
  const db = database(sql);
  const key = secret ?? clubCodeSecret();
  await ensureClubTables(db);

  const firstName = (input.firstName ?? "").trim().slice(0, 120);
  for (let attempt = 0; attempt < JOIN_ATTEMPTS; attempt += 1) {
    const memberCode = makeCode();
    const hash = hashMemberCode(memberCode, key);
    if (!hash) throw new Error("Could not create the membership");
    const created = await firstMember(db, INSERT_MEMBER, [email, firstName, hash]);
    if (created) return { created: true, member: created, memberCode };

    // Either the email is already a member, or the (astronomically unlikely)
    // code hash collided. Only the first case is final.
    const existing = await firstMember(db, SELECT_MEMBER, [email]);
    if (existing) return { created: false, member: existing, memberCode: null };
  }
  throw new Error("Could not create the membership");
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

export type ReserveResult =
  | { status: "reserved"; points: number; member: ClubMember }
  | { status: "duplicate"; points: number }
  | { status: "insufficient" };

/**
 * Takes points off the balance for one order, before the order row exists.
 * Idempotent per order reference. Release them with `releaseRedemption` if the
 * order is never created or is cancelled unpaid.
 */
export async function reserveRedemption(
  input: { email: string; points: number; orderReference: string },
  sql: Sql | null = getSql(),
): Promise<ReserveResult> {
  const email = normalizeClubEmail(input.email);
  const points = Math.max(0, Math.floor(input.points));
  const reference = input.orderReference.trim();
  if (!email || points <= 0 || !reference) return { status: "insufficient" };
  const db = database(sql);
  await ensureClubTables(db);

  const member = await firstMember(db, RESERVE_POINTS, [
    email,
    points,
    reference,
    "Reserved for an order",
  ]);
  if (member) return { status: "reserved", points, member };

  const existing = rowsOf(await db.query(SELECT_RESERVATION, [reference]))[0] as
    | Record<string, unknown>
    | undefined;
  if (existing) return { status: "duplicate", points: Math.abs(readInt(existing.points)) };
  return { status: "insufficient" };
}

/**
 * Returns an order's reserved points to the member. Safe to call any number of
 * times: the unique ledger index lets only the first call move the balance.
 * Returns `null` when there is nothing (left) to release.
 */
export async function releaseRedemption(
  orderReference: string,
  note = "Order did not complete",
  sql: Sql | null = getSql(),
): Promise<ClubMember | null> {
  const reference = orderReference.trim();
  if (!reference) return null;
  const db = database(sql);
  await ensureClubTables(db);
  return firstMember(db, RELEASE_POINTS, [reference, note]);
}

export type ClubAward =
  | { status: "awarded"; email: string; points: number; member: ClubMember }
  | { status: "duplicate" | "not_member" | "disabled" | "skipped" };

/**
 * Called when an order is paid, and again by reconciliation. Idempotent: the
 * unique index on (order_reference, reason) means a repeat inserts no ledger
 * row and therefore moves no balance and no lifetime spend. Points are earned
 * at the tier held *before* this order. While the programme is not approved
 * nothing is awarded.
 */
export async function awardOrderPoints(
  input: { email: string; orderReference: string; paidCents: number },
  sql: Sql | null = getSql(),
  program: ActiveClubProgram | null = activeClubProgram(),
): Promise<ClubAward> {
  if (!program) return { status: "disabled" };
  const email = normalizeClubEmail(input.email);
  const paidCents = Math.max(0, Math.floor(input.paidCents));
  const reference = (input.orderReference ?? "").trim();
  if (!email || !reference || paidCents <= 0) return { status: "skipped" };

  const db = database(sql);
  const member = await findMember(email, db);
  if (!member) return { status: "not_member" };

  const tier = tierForSpend(program, member.lifetimeSpendCents);
  const points = pointsForOrder(tier, paidCents);
  const updated = await firstMember(db, AWARD_ORDER_POINTS, [
    email,
    points,
    reference,
    `${tier.name} earn rate`,
    paidCents,
  ]);
  if (!updated) return { status: "duplicate" };
  return { status: "awarded", email, points, member: updated };
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
  return firstMember(db, ADJUST_POINTS, [email, points, note]);
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

export type ReconcileSummary = {
  enabled: boolean;
  awardedOrders: string[];
  releasedOrders: string[];
  failures: string[];
};

/**
 * The retry path for club work that failed after the payment or cancellation
 * itself succeeded. Re-runs every missing award (paid orders for members with
 * no `order` ledger row, paid on or after both the member joined and earning
 * began) and every missing release (cancelled orders, and reservations whose
 * order row was never written, whose points were never returned). Both are idempotent, so running it twice is harmless.
 */
export async function reconcileClub(
  options: { limit?: number } = {},
  sql: Sql | null = getSql(),
  program: ActiveClubProgram | null = activeClubProgram(),
): Promise<ReconcileSummary> {
  const db = database(sql);
  await ensureClubTables(db);
  const limit = Math.min(500, Math.max(1, Math.trunc(options.limit ?? 100)));
  const summary: ReconcileSummary = {
    enabled: program !== null,
    awardedOrders: [],
    releasedOrders: [],
    failures: [],
  };

  const releases: [string, string][] = [
    [LIST_UNRELEASED_ORDERS, "Order cancelled"],
    [LIST_ORPHAN_RESERVATIONS, "Order was not created"],
  ];
  for (const [query, note] of releases) {
    for (const row of rowsOf(await db.query(query, [limit]))) {
      const reference = readText((row as Record<string, unknown>).reference);
      try {
        const released = await releaseRedemption(reference, note, db);
        if (released) summary.releasedOrders.push(reference);
      } catch {
        summary.failures.push(reference);
      }
    }
  }

  if (!program) return summary;
  const unawarded = rowsOf(
    await db.query(LIST_UNAWARDED_ORDERS, [program.earningStartsAt.toISOString(), limit]),
  );
  for (const row of unawarded) {
    const record = row as Record<string, unknown>;
    const reference = readText(record.reference);
    try {
      const award = await awardOrderPoints(
        { email: readText(record.email), orderReference: reference, paidCents: readInt(record.total_cents) },
        db,
        program,
      );
      if (award.status === "awarded") summary.awardedOrders.push(reference);
    } catch {
      summary.failures.push(reference);
    }
  }
  return summary;
}
