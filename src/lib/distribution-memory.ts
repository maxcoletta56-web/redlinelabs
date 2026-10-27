import type { Sql } from "./db.ts";

/**
 * In-memory stand-in for the distribution tables. Used only when
 * `DISTRIBUTION_DEV_STORE=1` and `NODE_ENV` is not production, so a local
 * server can exercise approval and quotes without Neon. Production never
 * reads this, and a real `DATABASE_URL` wins when it is set.
 */
export function createDistributionMemorySql() {
  const accounts: Array<Record<string, unknown>> = [];
  const quotes: Array<Record<string, unknown>> = [];
  const sql: Sql = {
    async query(query, params = []) {
      const text = query.replace(/\s+/g, " ").trim();
      if (text.startsWith("CREATE")) return [];
      if (text.startsWith("INSERT INTO distribution_accounts")) {
        if (accounts.some((row) => row.email === params[1])) return [];
        const row = {
          id: params[0],
          email: params[1],
          password_hash: params[2],
          password_salt: params[3],
          business_name: params[4],
          contact_name: params[5],
          phone: params[6],
          abn: params[7],
          region: params[8],
          website: params[9],
          message: params[10],
          status: "pending",
          review_note: "",
          created_at: new Date().toISOString(),
          reviewed_at: null,
        };
        accounts.push(row);
        return [row];
      }
      if (text.startsWith("SELECT id, email, password_hash")) {
        return accounts.filter((row) => row.email === params[0]);
      }
      if (text.includes("FROM distribution_accounts WHERE id")) {
        return accounts.filter((row) => row.id === params[0]);
      }
      if (text.startsWith("SELECT id, email, business_name") && text.includes("ORDER BY")) {
        return [...accounts].reverse();
      }
      if (text.startsWith("UPDATE distribution_accounts")) {
        const row = accounts.find((item) => item.id === params[0]);
        if (!row) return [];
        row.status = params[1];
        row.review_note = params[2];
        row.reviewed_at = new Date().toISOString();
        return [row];
      }
      if (text.startsWith("INSERT INTO distribution_quotes")) {
        if (quotes.some((row) => row.reference === params[0])) {
          throw new Error("duplicate key value violates unique constraint 23505");
        }
        const row = {
          reference: params[0],
          account_id: params[1],
          lines: params[2],
          note: params[3],
          admin_note: "",
          subtotal_cents: params[4],
          status: params[5] === "quoted" ? "quoted" : "requested",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        quotes.push(row);
        return [row];
      }
      if (text.startsWith("SELECT reference, account_id")) {
        return quotes.filter((row) => row.account_id === params[0]);
      }
      if (text.startsWith("SELECT q.reference")) {
        return [...quotes].reverse().map((row) => {
          const account = accounts.find((item) => item.id === row.account_id);
          return {
            ...row,
            business_name: account?.business_name ?? "",
            contact_name: account?.contact_name ?? "",
            email: account?.email ?? "",
          };
        });
      }
      if (text.startsWith("UPDATE distribution_quotes")) {
        const row = quotes.find((item) => item.reference === params[0]);
        if (!row) return [];
        if (text.includes("SET lines")) {
          if (row.status === "declined") return [];
          row.lines = params[1];
          row.subtotal_cents = params[2];
          if (row.status === "requested") row.status = "quoted";
          row.updated_at = new Date().toISOString();
          return [row];
        }
        row.status = params[1];
        row.admin_note = params[2];
        row.updated_at = new Date().toISOString();
        return [row];
      }
      throw new Error(`Unexpected distribution SQL: ${text}`);
    },
  };
  return { sql, accounts, quotes };
}

let devStore: Sql | null = null;
let noted = false;

export function distributionDevStoreEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NODE_ENV !== "production" && env.DISTRIBUTION_DEV_STORE === "1";
}

export function distributionDevStoreSql() {
  if (!devStore) {
    if (!noted) {
      noted = true;
      console.warn(
        "[distribution] DISTRIBUTION_DEV_STORE is on; applications and quotes stay in this process only",
      );
    }
    devStore = createDistributionMemorySql().sql;
  }
  return devStore;
}
