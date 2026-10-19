/** Used only when @neondatabase/serverless is not installed. Tests inject their own SQL. */
export function neon() {
  throw new Error("DATABASE_URL client is not available in this test");
}
