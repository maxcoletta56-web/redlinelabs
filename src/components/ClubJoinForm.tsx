"use client";

import Link from "next/link";
import { useState } from "react";
import { RESEARCH_DISCLAIMER } from "@/lib/company";

type JoinState =
  | { status: "idle" }
  | { status: "joined"; memberCode: string }
  | { status: "existing"; message: string };

export function ClubJoinForm({ id = "club-join" }: { id?: string }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<JoinState>({ status: "idle" });

  if (state.status === "joined") {
    return (
      <div className="surface p-6" role="status">
        <p className="kicker mb-2">Welcome to the club</p>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Your member code
        </p>
        <p className="mt-1 font-mono text-[22px] tracking-[0.18em] text-[#d4af37]">
          {state.memberCode}
        </p>
        <p className="mt-3 text-xs leading-6 text-[#8f8c84]">
          Save this code. With your email it is how you check your balance and spend points at
          checkout. We cannot show it again here.
        </p>
        <Link href="/club/balance" className="btn-ghost mt-4 inline-flex">
          Check my balance
        </Link>
        <p className="mt-4 text-[11px] leading-5 text-[#8f8c84]">{RESEARCH_DISCLAIMER}</p>
      </div>
    );
  }

  if (state.status === "existing") {
    return (
      <div className="surface p-6" role="status">
        <p className="text-sm leading-7 text-[#cfc8b8]">{state.message}</p>
        <Link href="/club/balance" className="btn-ghost mt-4 inline-flex">
          Go to balance lookup
        </Link>
        <p className="mt-4 text-[11px] leading-5 text-[#8f8c84]">{RESEARCH_DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <form
      className="surface space-y-4 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        fetch("/api/club/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), firstName: firstName.trim() }),
        })
          .then(async (response) => {
            const body: unknown = await response.json().catch(() => null);
            const record = (body ?? {}) as Record<string, unknown>;
            if (!response.ok) {
              setError(
                typeof record.error === "string" ? record.error : "Could not join right now",
              );
              return;
            }
            if (record.created && typeof record.memberCode === "string") {
              setState({ status: "joined", memberCode: record.memberCode });
              return;
            }
            setState({
              status: "existing",
              message:
                typeof record.message === "string"
                  ? record.message
                  : "That email is already in the club.",
            });
          })
          .catch(() => setError("Could not join right now"))
          .finally(() => setPending(false));
      }}
    >
      <label htmlFor={`${id}-first-name`} className="block">
        <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          First name (optional)
        </span>
        <input
          id={`${id}-first-name`}
          className="field w-full"
          value={firstName}
          autoComplete="given-name"
          onChange={(event) => setFirstName(event.target.value)}
        />
      </label>
      <label htmlFor={`${id}-email`} className="block">
        <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Email
        </span>
        <input
          id={`${id}-email`}
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          className="field w-full"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      {error && (
        <p className="text-xs leading-5 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Joining…" : "Join the club"}
      </button>
      <p className="text-xs leading-6 text-[#8f8c84]">
        Membership is free. Use the same email at checkout and points are added automatically once
        payment clears. Your member code is shown once and cannot be recovered from this page.
      </p>
      <p className="text-[11px] leading-5 text-[#8f8c84]">{RESEARCH_DISCLAIMER}</p>
    </form>
  );
}
