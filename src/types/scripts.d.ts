declare module "../../scripts/ensure-comments-table.mjs" {
  export function commentsDatabaseUrl(env?: NodeJS.ProcessEnv): string;
  export function neonQuery(
    connectionString: string,
    query: string,
    params?: unknown[],
  ): Promise<unknown>;
  export function ordersSchemaStatements(): string[];
}
