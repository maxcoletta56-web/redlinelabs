"use client";

import { useState } from "react";
import { formatCents, formatPoints } from "@/lib/club";

type MemberSummary = {
  firstName: string;
  tier: string;
  points: number;
  pointsValueCents: number;
  membershipUntil: string | null;
  membershipCancelAt: string | null;
  membershipActive: boolean;
};

type LedgerEntry = {
  points: number;
  reason: string;
  orderReference: string | null;
  note: string;
  createdAt: string | null;
};

const REASON_LABELS: Record<string, string> = {
  join: "Welcome points",
  first_order: "First order bonus",
  order: "Order earn",
  redeem: "Redeemed at checkout",
  adjust: "Adjustment",
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
  const [cancelNote, setCancelNote] = useState<string | null>(null);

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
            placeholder="RL-XXXXXX"
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
          {pending ? "Checking…" : "Show my membership"}
        </button>
      </form>

      {member && (
        <section className="surface p-6" aria-live="polite">
          <p className="kicker mb-2">
            {member.membershipActive ? "Active membership" : "No active membership"}
          </p>
          <p className="text-[1.6rem] font-semibold tracking-[-0.03em] text-white">
            {member.membershipActive
              ? `Access until ${formatDate(member.membershipUntil)}`
              : "Member prices are off"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#8f8c84]">
            {member.membershipCancelAt
              ? "Renewal is cancelled. Pricing stays on until the date above."
              : "Cancel anytime. Access continues until the end of the period you have paid."}
          </p>
          {member.membershipActive && !member.membershipCancelAt && (
            <button
              type="button"
              className="btn-ghost mt-4"
              onClick={() => {
                setCancelNote(null);
                fetch("/api/club/cancel", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: email.trim(), code: code.trim() }),
                })
                  .then(async (response) => {
                    const body: unknown = await response.json().catch(() => null);
                    const record = (body ?? {}) as { member?: MemberSummary; error?: string };
                    if (!response.ok || !record.member) {
                      setCancelNote(record.error ?? "Could not cancel that membership");
                      return;
                    }
                    setMember(record.member);
                    setCancelNote("Renewal cancelled. Access continues until the paid period ends.");
                  })
                  .catch(() => setCancelNote("Could not cancel that membership"));
              }}
            >
              Cancel renewal
            </button>
          )}
          {cancelNote && <p className="mt-3 text-sm text-[#d4af37]">{cancelNote}</p>}
          {member.points > 0 && (
            <p className="mt-4 text-sm text-[#8f8c84]">
              Older points balance: {formatPoints(member.points)} ({formatCents(member.pointsValueCents)}).
              New orders use member pricing instead of points.
            </p>
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
    </div>
  );
}
