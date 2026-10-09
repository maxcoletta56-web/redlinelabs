"use client";

import { useState } from "react";
import { formatCents, formatPoints } from "@/lib/club";
import { RESEARCH_DISCLAIMER } from "@/lib/company";

type MemberSummary = {
  firstName: string;
  tier: string | null;
  points: number;
  pointsValueCents: number | null;
  lifetimeSpendCents: number;
  nextTier: string | null;
  nextTierRemainingCents: number | null;
  tierProgressPercent: number | null;
};

type LedgerEntry = {
  points: number;
  reason: string;
  orderReference: string | null;
  note: string;
  createdAt: string | null;
};

const REASON_LABELS: Record<string, string> = {
  order: "Points earned",
  redeem: "Applied to an order",
  redeem_release: "Returned from a cancelled order",
  adjust: "Adjustment",
  join: "Welcome points",
  first_order: "First order bonus",
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeZone: "Australia/Sydney",
  }).format(date);
}

export function ClubBalanceLookup() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  return (
    <div className="space-y-8">
      <form
        className="surface space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError(null);
          fetch("/api/club/balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), code: code.trim() }),
          })
            .then(async (response) => {
              const body: unknown = await response.json().catch(() => null);
              const record = (body ?? {}) as Record<string, unknown>;
              if (!response.ok) {
                setMember(null);
                setLedger([]);
                setError(
                  typeof record.error === "string"
                    ? record.error
                    : "Could not read that balance",
                );
                return;
              }
              setMember(record.member as MemberSummary);
              setLedger(Array.isArray(record.ledger) ? (record.ledger as LedgerEntry[]) : []);
            })
            .catch(() => setError("Could not read that balance"))
            .finally(() => setPending(false));
        }}
      >
        <label htmlFor="balance-email" className="block">
          <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
            Email
          </span>
          <input
            id="balance-email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            className="field w-full"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label htmlFor="balance-code" className="block">
          <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
            Member code
          </span>
          <input
            id="balance-code"
            required
            className="field w-full font-mono tracking-[0.12em]"
            placeholder="RL-XXXXXXXXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        {error && (
          <p className="text-xs leading-5 text-[#d4af37]" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn w-full" disabled={pending} aria-busy={pending}>
          {pending ? "Checking…" : "Show my balance"}
        </button>
      </form>

      {member && (
        <section className="surface p-6" aria-live="polite">
          <p className="kicker mb-2">{member.tier ? `${member.tier} member` : "Redline Club member"}</p>
          <p className="text-[2rem] font-semibold tracking-[-0.03em] text-white">
            {formatPoints(member.points)} points
          </p>
          <p className="mt-1 text-sm text-[#8f8c84]">
            {member.pointsValueCents === null
              ? "Points value will be shown once programme rates are published."
              : `Worth ${formatCents(member.pointsValueCents)} off your next order.`}
          </p>
          <dl className="mt-6 space-y-2 text-sm text-[#8f8c84]">
            <div className="flex justify-between gap-4">
              <dt>Lifetime spend</dt>
              <dd className="text-[#cfc8b8]">{formatCents(member.lifetimeSpendCents)}</dd>
            </div>
            {member.nextTier && member.nextTierRemainingCents !== null && (
              <div className="flex justify-between gap-4">
                <dt>To {member.nextTier}</dt>
                <dd className="text-[#cfc8b8]">
                  {formatCents(member.nextTierRemainingCents)} more spend
                </dd>
              </div>
            )}
          </dl>
          {member.nextTier && member.tierProgressPercent !== null && (
            <div
              className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(212,175,55,0.16)]"
              role="progressbar"
              aria-valuenow={member.tierProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress to ${member.nextTier}`}
            >
              <div
                className="h-full bg-[#d4af37]"
                style={{ width: `${member.tierProgressPercent}%` }}
              />
            </div>
          )}

          {ledger.length > 0 && (
            <>
              <h2 className="mt-8 mb-3 text-[13px] font-semibold tracking-[0.12em] uppercase">
                Recent activity
              </h2>
              <ul className="space-y-3 text-sm">
                {ledger.map((entry, index) => (
                  <li
                    key={`${entry.createdAt ?? index}-${index}`}
                    className="flex justify-between gap-4 border-b border-[rgba(212,175,55,0.1)] pb-3"
                  >
                    <span className="text-[#cfc8b8]">
                      {REASON_LABELS[entry.reason] ?? (entry.note || "Points")}
                      {entry.orderReference ? ` · ${entry.orderReference}` : ""}
                      <span className="block text-xs text-[#8f8c84]">
                        {formatDate(entry.createdAt)}
                      </span>
                    </span>
                    <span className={entry.points < 0 ? "text-[#8f8c84]" : "text-[#d4af37]"}>
                      {entry.points > 0 ? "+" : "−"}
                      {formatPoints(Math.abs(entry.points))}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <p className="text-[11px] leading-5 text-[#8f8c84]">{RESEARCH_DISCLAIMER}</p>
    </div>
  );
}
