"use client";

import Link from "next/link";
import { useState } from "react";
import { REDEEM_STEP_POINTS, formatCents, formatPoints, pointsValueCents } from "@/lib/club";
import { useClub } from "@/lib/club-state";
import { paymentsProvider } from "@/lib/payments-provider";

/**
 * Lets a member spend points on this order. Everything shown here is a
 * preview: the server re-checks the member, the balance and the cap before a
 * cent comes off the total.
 */
export function ClubRedeem({ payableCents }: { payableCents: number }) {
  const { member, points, maxPoints, pending, error, verify, setPoints, clear } = useClub();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  // Points come off bank-transfer orders only; the PayPal card rail charges the full total.
  if (paymentsProvider() !== "bank_transfer") return null;

  if (member) {
    return (
      <div className="mb-4 border-t border-[rgba(212,175,55,0.16)] pt-4">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Redline Club
        </p>
        <p className="mt-2 text-sm text-[#cfc8b8]">
          {member.tier} · {formatPoints(member.points)} points available
        </p>
        {maxPoints >= REDEEM_STEP_POINTS ? (
          <label className="mt-3 block">
            <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
              Points to spend
            </span>
            <select
              className="field w-full"
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
            >
              {Array.from(
                { length: Math.floor(maxPoints / REDEEM_STEP_POINTS) + 1 },
                (_, index) => index * REDEEM_STEP_POINTS,
              ).map((value) => (
                <option key={value} value={value}>
                  {value === 0
                    ? "None"
                    : `${formatPoints(value)} points · −${formatCents(pointsValueCents(value))}`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[#8f8c84]">
            You need at least {REDEEM_STEP_POINTS} points, and an order has to keep at least $1
            payable, so there is nothing to apply here yet.
          </p>
        )}
        <button
          type="button"
          onClick={clear}
          className="mt-2 min-h-11 text-sm text-[#8f8c84] hover:text-[#d4af37]"
        >
          Use a different membership
        </button>
      </div>
    );
  }

  return (
    <form
      className="mb-4 border-t border-[rgba(212,175,55,0.16)] pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        void verify({ email: email.trim(), code: code.trim(), payableCents });
      }}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
        Redline Club points
      </p>
      <div className="space-y-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Member email"
          className="field min-h-11 w-full py-2 text-base"
          aria-label="Club member email"
        />
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Member code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="field min-h-11 min-w-0 flex-1 py-2 text-base"
            aria-label="Club member code"
          />
          <button
            type="submit"
            className="btn-ghost min-h-11 shrink-0 px-4"
            disabled={pending}
            aria-busy={pending}
          >
            Apply
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs leading-5 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs leading-5 text-[#8f8c84]">
        Not a member?{" "}
        <Link href="/club" className="text-[#d4af37]">
          Join the Redline Club
        </Link>{" "}
        and start with {REDEEM_STEP_POINTS} points.
      </p>
    </form>
  );
}
