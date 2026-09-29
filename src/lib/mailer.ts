import { COMPANY_EMAIL } from "./company.ts";

const RESEARCH_DISCLAIMER =
  "For laboratory research use only. Not for human or veterinary consumption. Not evaluated or approved for the diagnosis, treatment, cure, or prevention of any disease.";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type MailEnv = {
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export type PaymentReceivedInput = {
  reference: string;
  firstName: string;
  email: string;
  totalCents: number;
  orderUrl: string;
};

export type ConfirmationResult = "sent" | "unconfigured" | "failed";

/** AUD display from integer cents. 1995 becomes "$19.95". */
export function formatAudFromCents(cents: number) {
  const negative = cents < 0;
  const absolute = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${remainder.toString().padStart(2, "0")}`;
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function orderPageUrl(reference: string, env: MailEnv) {
  const base = (env.NEXT_PUBLIC_SITE_URL?.trim() || "https://redlinelabs.shop").replace(/\/$/, "");
  return `${base}/order/${encodeURIComponent(reference)}`;
}

export function buildPaymentReceivedEmail(input: PaymentReceivedInput) {
  const amount = formatAudFromCents(input.totalCents);
  const name = input.firstName.trim() || "there";
  const text = [
    `Payment received for order ${input.reference}`,
    "",
    `Hello ${name},`,
    "",
    `We have received ${amount} AUD for order ${input.reference}. It is queued for dispatch.`,
    "",
    `Order page: ${input.orderUrl}`,
    "",
    RESEARCH_DISCLAIMER,
    "",
    `Questions about this order: ${COMPANY_EMAIL}`,
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><body style="margin:0;background:#050505;color:#f3f1ea;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="560" style="max-width:560px;background:#0b0b0b;border:1px solid #d4af37;">
      <tr><td style="padding:18px 24px;background:#d4af37;color:#050505;font-size:13px;font-weight:bold;letter-spacing:0.14em;">REDLINE LABS</td></tr>
      <tr><td style="padding:24px;font-size:14px;line-height:1.5;">
        <p style="margin:0 0 16px;font-size:20px;color:#d4af37;">Payment received</p>
        <p style="margin:0 0 12px;">Hello ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px;">We have received ${escapeHtml(amount)} AUD for order ${escapeHtml(input.reference)}. It is queued for dispatch.</p>
        <p style="margin:0 0 16px;"><a href="${escapeHtml(input.orderUrl)}" style="color:#d4af37;">View order ${escapeHtml(input.reference)}</a></p>
        <p style="margin:0 0 12px;color:#8f8c84;">${escapeHtml(RESEARCH_DISCLAIMER)}</p>
        <p style="margin:0;color:#8f8c84;">Questions about this order: <a href="mailto:${escapeHtml(COMPANY_EMAIL)}" style="color:#d4af37;">${escapeHtml(COMPANY_EMAIL)}</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return {
    to: singleLine(input.email),
    subject: singleLine(`Payment received for order ${input.reference}`),
    text,
    html,
  };
}

function currentMailEnv(env?: MailEnv): MailEnv {
  if (env) return env;
  return {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ORDER_EMAIL_FROM: process.env.ORDER_EMAIL_FROM,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

/**
 * Sends the paid-order confirmation. A missing Resend key or from-address
 * returns `unconfigured` so the webhook can retry once email is set up.
 */
export async function sendPaymentReceivedEmail(
  notice: {
    reference: string;
    firstName: string;
    email: string;
    totalCents: number;
  },
  env?: MailEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<ConfirmationResult> {
  const resolved = currentMailEnv(env);
  const apiKey = resolved.RESEND_API_KEY?.trim() ?? "";
  const from = singleLine(resolved.ORDER_EMAIL_FROM ?? "");
  const message = buildPaymentReceivedEmail({
    ...notice,
    orderUrl: orderPageUrl(notice.reference, resolved),
  });
  if (!apiKey || !from || !message.to) return "unconfigured";

  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok ? "sent" : "failed";
  } catch (error) {
    console.error("[mailer] payment email failed", {
      reference: notice.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return "failed";
  }
}
