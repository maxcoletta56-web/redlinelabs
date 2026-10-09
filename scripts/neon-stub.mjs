/** Used only when @neondatabase/serverless is not installed. Tests inject their own SQL. */
export function neon() {
  throw new Error("@neondatabase/serverless is not installed");
}
