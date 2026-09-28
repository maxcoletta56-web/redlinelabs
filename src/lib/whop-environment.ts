export const WHOP_ENVIRONMENTS = ["sandbox", "production"] as const;

export type WhopEnvironmentName = (typeof WHOP_ENVIRONMENTS)[number];

/** Sandbox until WHOP_ENVIRONMENT is exactly production. */
export function whopEnvironmentName(value: string | null | undefined): WhopEnvironmentName {
  return value?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}
