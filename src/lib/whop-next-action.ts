export type NextActionView =
  | {
      kind: "redirect";
      url: string;
      mode: "inline" | "full_page";
      frameMaxWidth: number | null;
    }
  | { kind: "await_confirmation"; expiresAt: string }
  | {
      kind: "instructions";
      title: string;
      rows: Array<{ label: string; value: string }>;
      documentUrl: string | null;
      instructions: string | null;
      expiresAt: string | null;
    };

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
  if (modes.includes("inline") || modes.includes("iframe")) return "inline";
  return "full_page";
}

function moneyLabel(value: unknown) {
  const row = asRecord(value);
  if (!row) return readString(value);
  const amount = row.amount;
  const currency = readString(row.currency);
  if (typeof amount === "number") {
    return currency ? `${amount} ${currency.toUpperCase()}` : String(amount);
  }
  return readString(amount);
}

function addRow(rows: Array<{ label: string; value: string }>, label: string, value: unknown) {
  const text = readString(value) || moneyLabel(value);
  if (!label || !text) return;
  rows.push({ label, value: text });
}

function bankRows(details: Record<string, unknown>) {
  const rows: Array<{ label: string; value: string }> = [];
  addRow(rows, readString(details.account_number_label) || "Account number", details.account_number);
  addRow(
    rows,
    readString(details.secondary_account_number_label) || "Second account number",
    details.secondary_account_number,
  );
  addRow(rows, "Bank code", details.bank_code);
  addRow(rows, "Bank", details.bank_name);
  addRow(rows, "Branch", details.bank_branch);
  addRow(rows, "Account type", details.bank_account_type);
  addRow(rows, "Account name", details.beneficiary_name);
  addRow(rows, "Reference", details.reference);
  addRow(rows, "Amount", details.amount);
  return rows;
}

/**
 * Map a Whop payment `next_action` onto the step the payments API describes:
 * redirect (3D Secure and other hosted pages), display instructions, or wait.
 */
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
    const expiresAt = readString(data.expires_at) || null;
    if (data.kind === "bank_transfer") {
      const details = asRecord(data.bank_transfer) ?? {};
      return {
        kind: "instructions",
        title: "Bank transfer",
        rows: bankRows(details),
        documentUrl: safeHttpsUrl(readString(details.document_url)) ?? documentUrl,
        instructions: readString(details.instructions) || instructions,
        expiresAt: readString(details.expires_at) || expiresAt,
      };
    }
    if (data.kind === "qr") {
      const details = asRecord(data.qr) ?? {};
      const rows: Array<{ label: string; value: string }> = [];
      addRow(rows, "Payment key", details.key);
      addRow(rows, "Amount", details.amount);
      return {
        kind: "instructions",
        title: "Scan to pay",
        rows,
        documentUrl: safeHttpsUrl(readString(details.document_url)) ?? documentUrl,
        instructions,
        expiresAt: readString(details.expires_at) || expiresAt,
      };
    }
    if (data.kind === "voucher") {
      const details = asRecord(data.voucher) ?? {};
      const rows: Array<{ label: string; value: string }> = [];
      addRow(rows, "Voucher", details.reference ?? details.code ?? details.barcode);
      addRow(rows, "Amount", details.amount);
      return {
        kind: "instructions",
        title: "Pay with voucher",
        rows,
        documentUrl: safeHttpsUrl(readString(details.document_url)) ?? documentUrl,
        instructions: readString(details.instructions) || instructions,
        expiresAt: readString(details.expires_at) || expiresAt,
      };
    }
    return {
      kind: "instructions",
      title: "Payment instructions",
      rows: [],
      documentUrl,
      instructions,
      expiresAt,
    };
  }
  return null;
}
