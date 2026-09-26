"use client";

import type { NextActionView } from "@/lib/whop-next-action";

export function WhopNextAction({ action }: { action: NextActionView }) {
  if (action.kind === "redirect" && action.mode === "inline") {
    return (
      <iframe
        title="Verify your card"
        src={action.url}
        className="min-h-[420px] w-full border-0"
        style={action.frameMaxWidth ? { maxWidth: action.frameMaxWidth } : undefined}
      />
    );
  }

  if (action.kind === "redirect") {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]">
        Your bank needs a verification step.{" "}
        <a className="text-[#d4af37]" href={action.url}>
          Continue
        </a>
      </p>
    );
  }

  if (action.kind === "await_confirmation") {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        The payment is waiting for confirmation
        {action.expiresAt ? ` until ${action.expiresAt}` : ""}. This page stays pending until Whop
        confirms it.
      </p>
    );
  }

  if (action.kind === "bank_transfer") {
    return (
      <div className="space-y-3 text-sm leading-6 text-[#8f8c84]">
        <p>Whop returned bank-transfer instructions for this payment.</p>
        {action.instructions && <p>{action.instructions}</p>}
        {action.rows.length > 0 && (
          <dl className="space-y-2">
            {action.rows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="flex justify-between gap-4">
                <dt>{row.label}</dt>
                <dd className="text-[#d4af37]">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {action.documentUrl && (
          <a className="text-[#d4af37]" href={action.documentUrl}>
            Open the transfer instructions
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-[#8f8c84]">
      {action.instructions && <p>{action.instructions}</p>}
      {action.documentUrl && (
        <a className="text-[#d4af37]" href={action.documentUrl}>
          Open the payment instructions
        </a>
      )}
    </div>
  );
}
