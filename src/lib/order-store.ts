import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ServerOrder } from "./server-order.ts";

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

let singleton: OrderStore | null = null;

export function getOrderStore() {
  if (!singleton) {
    const filePath =
      process.env.ORDER_STORE_PATH?.trim() || path.join(process.cwd(), ".data", "orders.json");
    singleton = createFileOrderStore(filePath);
  }
  return singleton;
}

export function resetOrderStoreForTests() {
  singleton = null;
}
