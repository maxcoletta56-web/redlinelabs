import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type { ServerOrder, ServerOrderStatus } from "./server-order.ts";

const CREATE_ORDERS =
  "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, payload TEXT NOT NULL)";

const UPSERT_ORDER = `INSERT INTO orders (id, payload) VALUES ($1, $2)
ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`;

const SELECT_ORDER = "SELECT payload FROM orders WHERE id = $1";

export type OrderSql = {
  query: (query: string, params?: unknown[]) => Promise<unknown>;
};

export type OrderStore = {
  get(id: string): Promise<ServerOrder | null>;
  put(order: ServerOrder): Promise<void>;
};

type OrderFile = Record<string, ServerOrder>;

export function memoryOrderStore(seed: ServerOrder[] = []): OrderStore {
  const orders = new Map(seed.map((order) => [order.id, order]));
  return {
    async get(id) {
      return orders.get(id) ?? null;
    },
    async put(order) {
      orders.set(order.id, structuredClone(order));
    },
  };
}

export function createFileOrderStore(filePath: string): OrderStore {
  let chain = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>) => {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const readAll = async (): Promise<OrderFile> => {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as OrderFile;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  };

  const writeAll = async (orders: OrderFile) => {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(orders), "utf8");
    await rename(temporary, filePath);
  };

  return {
    get(id) {
      return exclusive(async () => (await readAll())[id] ?? null);
    },
    put(order) {
      return exclusive(async () => {
        const orders = await readAll();
        orders[order.id] = order;
        await writeAll(orders);
      });
    },
  };
}

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: unknown[] }).rows;
  }
  return [];
}

function parseStoredOrder(value: unknown): ServerOrder | null {
  const row = value && typeof value === "object" ? (value as ServerOrder) : null;
  if (!row || typeof row.id !== "string" || !row.id) return null;
  const status: ServerOrderStatus | null =
    row.status === "pending" || row.status === "paid" || row.status === "failed" ? row.status : null;
  if (!status || !Array.isArray(row.lines) || typeof row.totalCents !== "number") return null;
  if (!row.appliedPayments || typeof row.appliedPayments !== "object") return null;
  return row;
}

function payloadFromRow(row: unknown): ServerOrder | null {
  if (!row || typeof row !== "object") return null;
  const payload = (row as { payload?: unknown }).payload;
  if (typeof payload === "string") {
    try {
      return parseStoredOrder(JSON.parse(payload) as unknown);
    } catch {
      return null;
    }
  }
  return parseStoredOrder(payload);
}

/** Durable store used when DATABASE_URL is set. Vercel instances share this table. */
export function createSqlOrderStore(sql: OrderSql): OrderStore {
  let ready: Promise<void> | null = null;
  const ensure = () => {
    ready ??= sql
      .query(CREATE_ORDERS)
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = null;
        throw error;
      });
    return ready;
  };

  return {
    async get(id) {
      await ensure();
      const result = await sql.query(SELECT_ORDER, [id]);
      return payloadFromRow(rowsOf(result)[0]) ?? null;
    },
    async put(order) {
      await ensure();
      await sql.query(UPSERT_ORDER, [order.id, JSON.stringify(order)]);
    },
  };
}

export function orderDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  return env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL?.trim() || "";
}

let singleton: OrderStore | null = null;

export function getOrderStore() {
  if (!singleton) {
    const url = orderDatabaseUrl();
    if (url) {
      const client = neon(url);
      singleton = createSqlOrderStore({
        query: (query, params) => client.query(query, params ?? []),
      });
    } else {
      const filePath =
        process.env.ORDER_STORE_PATH?.trim() || path.join(process.cwd(), ".data", "orders.json");
      singleton = createFileOrderStore(filePath);
    }
  }
  return singleton;
}

export function resetOrderStoreForTests() {
  singleton = null;
}
