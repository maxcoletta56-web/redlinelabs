export type NextActionView =
  | {
      kind: "redirect";
      url: string;
      mode: "inline" | "full_page";
      frameMaxWidth: number | null;
    }
  | { kind: "await_confirmation"; expiresAt: string }
  | {
      kind: "bank_transfer";
      rows: Array<{ label: string; value: string }>;
      documentUrl: string | null;
      instructions: string | null;
    }
  | { kind: "instructions"; documentUrl: string | null; instructions: string | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function safeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function presentation(render: unknown): "inline" | "full_page" {
  const modes = Array.isArray(render) ? render.filter((item) => typeof item === "string") : [];
  if (modes.includes("inline")) return "inline";
  return "full_page";
}

function bankRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: unknown) => {
    const text = readString(value);
    if (!label || !text) return;
    rows.push({ label, value: text });
  };
  add(readString(details.account_number_label) || "Account number", details.account_number);
  add(readString(details.secondary_account_number_label) || "Second account number", details.secondary_account_number);
  add(readString(details.bank_code_label) || "Bank code", details.bank_code);
  add("Routing number", details.routing_number);
  add("Bank", details.bank_name);
  add("Branch", details.bank_branch);
  add("Account name", details.beneficiary_name);
  add("Reference", details.reference);
  add("Amount", asRecord(details.amount)?.amount);
  return rows;
}

/** Map a Whop payment next action onto the inline or full-page step the docs describe. */
export function readNextAction(value: unknown): NextActionView | null {
  const action = asRecord(value);
  if (!action) return null;
  const data = asRecord(action.data);
  if (action.type === "redirect" && data) {
    const url = safeHttpsUrl(readString(data.url));
    if (!url) return null;
    const width = data.frame_max_width;
    return {
      kind: "redirect",
      url,
      mode: presentation(action.render),
      frameMaxWidth: typeof width === "number" && width > 0 ? width : null,
    };
  }
  if (action.type === "await_confirmation" && data) {
    const expiresAt = readString(data.expires_at);
    if (!expiresAt) return null;
    return { kind: "await_confirmation", expiresAt };
  }
  if (action.type === "display_instructions" && data) {
    const instructions = readString(data.instructions) || null;
    const documentUrl = safeHttpsUrl(readString(data.document_url));
    if (data.kind === "bank_transfer") {
      const details = asRecord(data.bank_transfer) ?? {};
      const hosted = safeHttpsUrl(readString(details.document_url)) ?? documentUrl;
      return {
        kind: "bank_transfer",
        rows: bankRows(details),
        documentUrl: hosted,
        instructions: readString(details.instructions) || instructions,
      };
    }
    return { kind: "instructions", documentUrl, instructions };
  }
  return null;
}
