import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  neonQuery,
  resultRows,
  schemaDatabaseUrl,
  schemaSql,
  statementForNeon,
} from "./neon-schema.mjs";

/** Neon's SQL-over-HTTP endpoint takes one statement per request. */
export function clubStatements() {
  return schemaSql("club.sql")
    .split(";")
    .map((statement) => statementForNeon(statement))
    .filter(Boolean);
}

/**
 * Orders written before `club_discount_cents` existed priced redeemed points at
 * 5 cents each, so that is the value to freeze onto them. Idempotent: it only
 * touches rows that have points but no recorded discount.
 */
export const BACKFILL_ORDER_DISCOUNTS =
  "UPDATE orders SET club_discount_cents = club_points_redeemed * 5 " +
  "WHERE club_points_redeemed > 0 AND club_discount_cents = 0";

const LEGACY_CODES =
  "SELECT email, member_code FROM club_members " +
  "WHERE member_code IS NOT NULL AND member_code_hash IS NULL";

const HASH_LEGACY_CODE =
  "UPDATE club_members SET member_code_hash = $2, member_code = NULL " +
  "WHERE email = $1 AND member_code_hash IS NULL";

const CLEAR_HASHED_PLAINTEXT =
  "UPDATE club_members SET member_code = NULL " +
  "WHERE member_code IS NOT NULL AND member_code_hash IS NOT NULL";

/** Mirrors normalizeMemberCode in src/lib/club.ts for the codes issued before hashing. */
export function normalizeLegacyCode(code) {
  const cleaned = String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("RL") ? cleaned.slice(2) : cleaned;
  return `RL-${body}`;
}

/** Mirrors hashMemberCode in src/lib/club-db.ts. */
export function hashLegacyCode(code, secret) {
  return createHmac("sha256", secret).update(normalizeLegacyCode(code)).digest("hex");
}

/**
 * Applies db/club.sql and the one-off data migrations:
 *  - freezes the discount value onto orders that redeemed points,
 *  - replaces plaintext member codes with their HMAC (needs CLUB_CODE_SECRET),
 *    then erases the plaintext.
 * Everything is idempotent. Returns false instead of throwing so the build step
 * decides how loudly to fail; a missing DATABASE_URL is a skip, exactly like the
 * orders migration. Plaintext codes that cannot be hashed (no secret) fail the
 * step on purpose: shipping with them still in the table is the thing to avoid.
 */
export async function ensureClubTables(options = {}) {
  const {
    connectionString = schemaDatabaseUrl(),
    query = (sql, params) => neonQuery(connectionString, sql, params),
    secret = process.env.CLUB_CODE_SECRET?.trim() ?? "",
    log = console.log,
    logError = console.error,
  } = options;

  if (!connectionString) {
    log("club tables: skipped (DATABASE_URL is not set)");
    return true;
  }

  try {
    for (const statement of clubStatements()) {
      await query(statement);
    }
    await query(BACKFILL_ORDER_DISCOUNTS);

    const legacy = resultRows(await query(LEGACY_CODES));
    if (legacy.length > 0) {
      if (secret.length < 32) {
        throw new Error(
          `${legacy.length} member code(s) are still stored in plaintext and CLUB_CODE_SECRET ` +
            "(32+ characters) is not set, so they cannot be hashed",
        );
      }
      for (const row of legacy) {
        await query(HASH_LEGACY_CODE, [row.email, hashLegacyCode(row.member_code, secret)]);
      }
      log(`club tables: hashed ${legacy.length} legacy member code(s)`);
    }
    await query(CLEAR_HASHED_PLAINTEXT);

    log("club tables: club_members and club_points_ledger are in place");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("club tables: failed to apply db/club.sql");
    logError(message.replaceAll(connectionString, "[redacted]"));
    return false;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  if (!(await ensureClubTables())) process.exit(1);
}
