export type StripeMode = "live" | "test";

export type ResolvedStripeKeys = {
  secret: string;
  publishable: string;
  mode: StripeMode;
};

export type StripeEnv = Record<string, string | undefined>;

const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_/;
const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_/;

export const SECRET_KEY_NAMES = ["STRIPE_SECRET_KEY", "REDLINE_STRIPE_SECRET_KEY"] as const;
export const PUBLISHABLE_KEY_NAMES = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_REDLINE_STRIPE_PUBLISHABLE_KEY",
  "REDLINE_STRIPE_PUBLISHABLE_KEY",
] as const;

function modeOf(key: string): StripeMode | undefined {
  if (key.includes("_live_")) return "live";
  if (key.includes("_test_")) return "test";
  return undefined;
}

function collect(env: StripeEnv, names: readonly string[], pattern: RegExp) {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value || !pattern.test(value) || seen.has(value)) return;
    seen.add(value);
    found.push(value);
  };

  for (const name of names) add(env[name]);
  for (const value of Object.values(env)) add(value);
  return found;
}

function pickPreferred(keys: string[], liveOnly: boolean) {
  const pool = liveOnly ? keys.filter((key) => modeOf(key) === "live") : keys;
  return pool.find((key) => modeOf(key) === "live") ?? pool[0];
}

export function shouldRequireLiveKeys(env: StripeEnv) {
  const required = env.STRIPE_REQUIRE_LIVE?.toLowerCase();
  if (required === "1" || required === "true") return true;
  return env.VERCEL_ENV === "production";
}

export function resolveStripeKeys(
  env: StripeEnv,
  options?: { liveOnly?: boolean },
): ResolvedStripeKeys | undefined {
  const liveOnly = options?.liveOnly ?? shouldRequireLiveKeys(env);
  const secret = pickPreferred(collect(env, SECRET_KEY_NAMES, SECRET_KEY_PATTERN), liveOnly);
  const publishable = pickPreferred(
    collect(env, PUBLISHABLE_KEY_NAMES, PUBLISHABLE_KEY_PATTERN),
    liveOnly,
  );

  if (!secret || !publishable) return undefined;

  const secretMode = modeOf(secret);
  const publishableMode = modeOf(publishable);
  if (!secretMode || secretMode !== publishableMode) return undefined;
  if (liveOnly && secretMode !== "live") return undefined;

  return { secret, publishable, mode: secretMode };
}
