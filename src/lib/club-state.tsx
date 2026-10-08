"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { REDEEM_STEP_POINTS } from "@/lib/club";

/**
 * Holds the member's checkout session for the current page only — never
 * persisted, because the member code is a secret and the balance it unlocks
 * is re-read and re-capped on the server at order creation anyway.
 */
export type ClubCheckoutMember = {
  email: string;
  code: string;
  firstName: string;
  tier: string;
  points: number;
  pointsValueCents: number;
};

type ClubContextValue = {
  member: ClubCheckoutMember | null;
  /** Points the customer has chosen to spend on this order. */
  points: number;
  maxPoints: number;
  pending: boolean;
  error: string | null;
  verify: (input: { email: string; code: string; payableCents: number }) => Promise<boolean>;
  setPoints: (points: number) => void;
  clear: () => void;
};

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const [member, setMember] = useState<ClubCheckoutMember | null>(null);
  const [points, setPointsState] = useState(0);
  const [maxPoints, setMaxPoints] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(
    async (input: { email: string; code: string; payableCents: number }) => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch("/api/club/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body: unknown = await response.json().catch(() => null);
        const record = (body ?? {}) as Record<string, unknown>;
        if (!response.ok) {
          setError(
            typeof record.error === "string"
              ? record.error
              : "Could not check that membership",
          );
          return false;
        }
        const summary = (record.member ?? {}) as Record<string, unknown>;
        const cap = Number(record.maxPoints) || 0;
        setMember({
          email: input.email,
          code: input.code,
          firstName: String(summary.firstName ?? ""),
          tier: String(summary.tier ?? "Member"),
          points: Number(summary.points) || 0,
          pointsValueCents: Number(summary.pointsValueCents) || 0,
        });
        setMaxPoints(cap);
        setPointsState(cap);
        return true;
      } catch {
        setError("Could not check that membership");
        return false;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const setPoints = useCallback(
    (next: number) => {
      const blocks = Math.floor(Math.max(0, next) / REDEEM_STEP_POINTS) * REDEEM_STEP_POINTS;
      setPointsState(Math.min(maxPoints, blocks));
    },
    [maxPoints],
  );

  const clear = useCallback(() => {
    setMember(null);
    setPointsState(0);
    setMaxPoints(0);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ member, points, maxPoints, pending, error, verify, setPoints, clear }),
    [member, points, maxPoints, pending, error, verify, setPoints, clear],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error("useClub must be used within ClubProvider");
  return ctx;
}
