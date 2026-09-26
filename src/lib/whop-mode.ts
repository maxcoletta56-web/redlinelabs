export type WhopMode = "sandbox" | "production";

/** Sandbox unless WHOP_ENV is explicitly live or production. */
export function whopModeFromEnv(value: string | undefined): WhopMode {
  const requested = value?.trim().toLowerCase();
  return requested === "live" || requested === "production" ? "production" : "sandbox";
}

export function audMajorUnits(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}
