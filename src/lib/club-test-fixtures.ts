import type { Sql } from "./db.ts";
import {
  ADJUST_POINTS,
  AWARD_ORDER_POINTS,
  INSERT_MEMBER,
  LIST_ORPHAN_RESERVATIONS,
  LIST_UNAWARDED_ORDERS,
  LIST_UNRELEASED_ORDERS,
  RELEASE_POINTS,
  RESERVE_POINTS,
  SELECT_LEDGER,
  SELECT_MEMBER,
  SELECT_MEMBER_WITH_CODE,
  SELECT_RESERVATION,
  type ClubMember,
} from "./club-db.ts";
import { activeClubProgram, type ClubProgramConfig } from "./club.ts";

/**
 * SYNTHETIC values for exercising the arithmetic in tests. They are not a
 * proposal and are never imported by application code: the real programme
 * stays unapproved in CLUB_PROGRAM until the business decides.
 */
export const TEST_PROGRAM_CONFIG: ClubProgramConfig = {
  approved: true,
  earningStartsAt: "2026-01-01T00:00:00Z",
  centsPerRedeemBlock: 500,
  tiers: [
    { name: "Test A", fromCents: 0, earnBasis: 100 },
    { name: "Test B", fromCents: 10_000, earnBasis: 150 },
    { name: "Test C", fromCents: 20_000, earnBasis: 200 },
    { name: "Test D", fromCents: 30_000, earnBasis: 250 },
  ],
};

export const TEST_PROGRAM = (() => {
  const program = activeClubProgram(TEST_PROGRAM_CONFIG);
  if (!program) throw new Error("test programme must be valid");
  return program;
})();

export const TEST_SECRET = "test-secret-".padEnd(40, "x");

export function testMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    email: "ada@example.com",
    firstName: "Ada",
    pointsBalance: 450,
    lifetimeSpendCents: 15_000,
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

type Row = {
  email: string;
  firstName: string;
  hash: string;
  balance: number;
  spend: number;
  createdAt: string;
};
type LedgerRow = {
  id: number;
  email: string;
  points: number;
  reason: string;
  orderReference: string | null;
  note: string;
  createdAt: number;
};
export type FakeOrder = {
  reference: string;
  email: string;
  status: "awaiting_payment" | "paid" | "cancelled";
  totalCents: number;
  clubPointsRedeemed: number;
  paidAt: string | null;
};

/**
 * An in-memory stand-in for the club tables. Each statement the app sends is
 * recognised by its exact text and applied as ONE atomic step, with a real
 * asynchronous gap before it so concurrent callers interleave exactly as they
 * would over HTTP. The statements' own SQL (row locks, unique indexes) is
 * verified against PostgreSQL separately; see docs/redline-club.md.
 */
export function createFakeClubSql() {
  const members = new Map<string, Row>();
  const ledger: LedgerRow[] = [];
  const orders: FakeOrder[] = [];
  let nextId = 1;
  const statements: string[] = [];

  const view = (row: Row) => ({
    email: row.email,
    first_name: row.firstName,
    points_balance: row.balance,
    lifetime_spend_cents: row.spend,
    created_at: row.createdAt,
  });
  const hasLedger = (reference: string | null, reason: string) =>
    reference !== null && ledger.some((l) => l.orderReference === reference && l.reason === reason);
  const add = (email: string, points: number, reason: string, reference: string | null, note: string) => {
    const row: LedgerRow = { id: nextId++, email, points, reason, orderReference: reference, note, createdAt: Date.now() };
    ledger.push(row);
    return row;
  };

  function run(query: string, p: unknown[]): unknown[] {
    statements.push(query);
    if (query.startsWith("CREATE")) return [];
    if (query === INSERT_MEMBER) {
      const [email, firstName, hash] = p as [string, string, string];
      if (members.has(email) || [...members.values()].some((m) => m.hash === hash)) return [];
      const row = { email, firstName, hash, balance: 0, spend: 0, createdAt: "2026-10-01T00:00:00Z" };
      members.set(email, row);
      return [view(row)];
    }
    if (query === SELECT_MEMBER) {
      const row = members.get(p[0] as string);
      return row ? [view(row)] : [];
    }
    if (query === SELECT_MEMBER_WITH_CODE) {
      const row = members.get(p[0] as string);
      return row && row.hash === p[1] ? [view(row)] : [];
    }
    if (query === AWARD_ORDER_POINTS) {
      const [email, points, reference, note, paid] = p as [string, number, string, string, number];
      const row = members.get(email);
      if (!row || hasLedger(reference, "order")) return [];
      add(email, points, "order", reference, note);
      row.balance += points;
      row.spend += paid;
      return [view(row)];
    }
    if (query === RESERVE_POINTS) {
      const [email, points, reference, note] = p as [string, number, string, string];
      const row = members.get(email);
      if (!row || row.balance < points || hasLedger(reference, "redeem")) return [];
      add(email, -points, "redeem", reference, note);
      row.balance -= points;
      return [view(row)];
    }
    if (query === RELEASE_POINTS) {
      const [reference, note] = p as [string, string];
      const held = ledger.find((l) => l.orderReference === reference && l.reason === "redeem");
      if (!held || hasLedger(reference, "redeem_release")) return [];
      add(held.email, -held.points, "redeem_release", reference, note);
      const row = members.get(held.email);
      if (!row) return [];
      row.balance -= held.points;
      return [view(row)];
    }
    if (query === SELECT_RESERVATION) {
      const held = ledger.find((l) => l.orderReference === p[0] && l.reason === "redeem");
      return held ? [{ points: held.points }] : [];
    }
    if (query === ADJUST_POINTS) {
      const [email, points, note] = p as [string, number, string];
      const row = members.get(email);
      if (!row || row.balance + points < 0) return [];
      add(email, points, "adjust", null, note);
      row.balance += points;
      return [view(row)];
    }
    if (query === SELECT_LEDGER) {
      return ledger
        .filter((l) => l.email === p[0])
        .sort((a, b) => b.id - a.id)
        .slice(0, p[1] as number)
        .map((l) => ({
          id: l.id,
          points: l.points,
          reason: l.reason,
          order_reference: l.orderReference,
          note: l.note,
          created_at: "2026-10-01T00:00:00Z",
        }));
    }
    if (query === LIST_UNAWARDED_ORDERS) {
      return orders
        .filter((o) => o.status === "paid" && members.has(o.email) && !hasLedger(o.reference, "order"))
        .map((o) => ({ reference: o.reference, email: o.email, total_cents: o.totalCents }));
    }
    if (query === LIST_UNRELEASED_ORDERS) {
      return orders
        .filter(
          (o) =>
            o.status === "cancelled" &&
            o.clubPointsRedeemed > 0 &&
            hasLedger(o.reference, "redeem") &&
            !hasLedger(o.reference, "redeem_release"),
        )
        .map((o) => ({ reference: o.reference }));
    }
    if (query === LIST_ORPHAN_RESERVATIONS) {
      return ledger
        .filter(
          (l) =>
            l.reason === "redeem" &&
            Date.now() - l.createdAt > 3_600_000 &&
            !orders.some((o) => o.reference === l.orderReference) &&
            !hasLedger(l.orderReference, "redeem_release"),
        )
        .map((l) => ({ reference: l.orderReference }));
    }
    throw new Error(`fake club sql does not know: ${query.slice(0, 80)}`);
  }

  const sql: Sql = {
    query: async (query, params) => {
      await new Promise((resolve) => setImmediate(resolve));
      return run(query, params ?? []);
    },
  };

  return {
    sql,
    statements,
    members,
    ledger,
    orders,
    /** Rewinds a ledger row so it looks older than the orphan grace period. */
    age(reference: string) {
      for (const l of ledger) if (l.orderReference === reference) l.createdAt -= 2 * 3_600_000;
    },
    seedMember(email: string, balance = 0, spend = 0) {
      members.set(email, {
        email,
        firstName: "",
        hash: `hash-${email}`,
        balance,
        spend,
        createdAt: "2026-10-01T00:00:00Z",
      });
    },
    balance(email: string) {
      return members.get(email)?.balance ?? 0;
    },
    ledgerSum(email: string) {
      return ledger.filter((l) => l.email === email).reduce((sum, l) => sum + l.points, 0);
    },
  };
}
