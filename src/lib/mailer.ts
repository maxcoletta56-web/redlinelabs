import { resolveBankTransfer, transferDescription } from "./bank-transfer.ts";
import { COMPANY_EMAIL, RESEARCH_DISCLAIMER } from "./company.ts";
import { formatShippingAddress, type ShippingAddressView } from "./order-shipping.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Logged at most once per process so a missing key cannot spam checkout. */
const notices = new Set<string>();

export type MailEnv = {
  RESEND_API_KEY?: string;
  ORDER_EMAIL_FROM?: string;
  ORDER_NOTIFY_EMAIL?: string;
  PAYID_ADDRESS?: string;
  PAYID_ACCOUNT_NAME?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export type OrderEmailItem = {
  name: string;
  qty: number;
  unitAmountCents: number;
};

export type OrderConfirmationInput = {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  items: OrderEmailItem[];
  subtotalCents: number;
  totalCents: number;
  promoCode: string | null;
  payId: string;
  accountName: string;
  orderUrl: string;
  shipping?: ShippingAddressView | null;
};

export type PaymentReceivedInput = {
  reference: string;
  firstName: string;
  email: string;
  totalCents: number;
  orderUrl: string;
};

export type RenderedEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** AUD display from integer cents. 1995 becomes "$19.95". */
export function formatAudFromCents(cents: number) {
  const negative = cents < 0;
  const absolute = Math.abs(Math.trunc(cents));
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}$${grouped}.${remainder.toString().padStart(2, "0")}`;
}

/** Merchant inbox. An explicit notify address wins; otherwise the PayID address. */
export function merchantNotifyEmail(env: MailEnv) {
  return env.ORDER_NOTIFY_EMAIL?.trim() || env.PAYID_ADDRESS?.trim() || "";
}

export function resetMailerForTests() {
  notices.clear();
}

type MailHooks = {
  fetchImpl?: typeof fetch;
  warn?: (message: string) => void;
  onError?: (message: string, detail: { reference: string; errorName: string; errorMessage: string }) => void;
};

function noteOnce(key: string, message: string, warn: (message: string) => void) {
  if (notices.has(key)) return;
  notices.add(key);
  warn(message);
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

function publicErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/re_[A-Za-z0-9_-]+/gi, "re_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

function customerName(input: { firstName: string; lastName?: string }) {
  return [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || "Customer";
}

function lineTotalCents(item: OrderEmailItem) {
  return item.unitAmountCents * item.qty;
}

function describeItem(item: OrderEmailItem) {
  const each = formatAudFromCents(item.unitAmountCents);
  const line = formatAudFromCents(lineTotalCents(item));
  return `${item.qty} × ${item.name} — ${each} each — ${line}`;
}

function orderPageUrl(reference: string, env: MailEnv) {
  const base = (env.NEXT_PUBLIC_SITE_URL?.trim() || "https://redlinelabs.shop").replace(/\/$/, "");
  return `${base}/order/${encodeURIComponent(reference)}`;
}

function htmlShell(heading: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#050505;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:#0b0b0b;border:1px solid #d4af37;">
          <tr>
            <td style="padding:18px 24px;background:#d4af37;color:#050505;font-family:Arial, Helvetica, sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.14em;">
              REDLINE LABS
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:1.5;color:#f3f1ea;">
              <p style="margin:0 0 16px;font-size:20px;color:#d4af37;">${escapeHtml(heading)}</p>
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function itemsTable(items: OrderEmailItem[]) {
  const rows = items
    .map((item) => {
      const label = escapeHtml(`${item.qty} × ${item.name}`);
      const detail = escapeHtml(`${formatAudFromCents(item.unitAmountCents)} each`);
      const amount = escapeHtml(formatAudFromCents(lineTotalCents(item)));
      return `<tr>
        <td style="padding:8px 0;color:#f3f1ea;border-bottom:1px solid #d4af37;">${label}<br><span style="color:#8f8c84;">${detail}</span></td>
        <td align="right" style="padding:8px 0;color:#d4af37;border-bottom:1px solid #d4af37;">${amount}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function totalRow(label: string, amount: string) {
  return `<tr>
    <td style="padding:6px 0;color:#8f8c84;">${escapeHtml(label)}</td>
    <td align="right" style="padding:6px 0;color:#d4af37;">${escapeHtml(amount)}</td>
  </tr>`;
}

function paymentInstructionsText(input: OrderConfirmationInput) {
  const description = transferDescription(input.reference);
  const amount = `${formatAudFromCents(input.totalCents)} AUD`;
  if (!input.payId || !input.accountName) {
    return [
      "Payment details are not published yet.",
      `Email ${COMPANY_EMAIL} quoting ${input.reference} and we will send transfer instructions.`,
    ].join("\n");
  }
  return [
    `PayID: ${input.payId}`,
    `Account name: ${input.accountName}`,
    `Amount: ${amount}`,
    `Transfer description: ${description}`,
    "Put the reference in the transfer description.",
  ].join("\n");
}

function paymentInstructionsHtml(input: OrderConfirmationInput) {
  if (!input.payId || !input.accountName) {
    return `<p style="margin:16px 0;color:#f3f1ea;">Payment details are not published yet. Email <a href="mailto:${escapeHtml(COMPANY_EMAIL)}" style="color:#d4af37;">${escapeHtml(COMPANY_EMAIL)}</a> quoting ${escapeHtml(input.reference)} and we will send transfer instructions.</p>`;
  }
  const rows = [
    ["PayID", input.payId],
    ["Account name", input.accountName],
    ["Amount", `${formatAudFromCents(input.totalCents)} AUD`],
    ["Transfer description", transferDescription(input.reference)],
  ]
    .map(
      ([label, value]) => `<tr>
        <td style="padding:6px 12px 6px 0;color:#8f8c84;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:6px 0;color:#d4af37;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  return `<p style="margin:16px 0 8px;color:#f3f1ea;">Put the reference in the transfer description.</p>
    <table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function totalsText(input: Pick<OrderConfirmationInput, "subtotalCents" | "totalCents" | "promoCode">) {
  const lines = [`Total: ${formatAudFromCents(input.totalCents)} AUD`];
  if (input.promoCode) {
    const discount = input.subtotalCents - input.totalCents;
    lines.unshift(
      `Subtotal: ${formatAudFromCents(input.subtotalCents)}`,
      `Promo code ${input.promoCode}: −${formatAudFromCents(discount)}`,
    );
  }
  return lines.join("\n");
}

function shippingText(shipping: ShippingAddressView | null | undefined) {
  return `Ship to:\n${formatShippingAddress(shipping)}`;
}

function shippingHtml(shipping: ShippingAddressView | null | undefined) {
  const body = formatShippingAddress(shipping)
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br>");
  return `<p style="margin:16px 0 8px;color:#d4af37;font-size:12px;letter-spacing:0.12em;">SHIP TO</p>
    <p style="margin:0 0 16px;">${body}</p>`;
}

function totalsHtml(input: Pick<OrderConfirmationInput, "subtotalCents" | "totalCents" | "promoCode">) {
  const rows = [];
  if (input.promoCode) {
    const discount = input.subtotalCents - input.totalCents;
    rows.push(totalRow("Subtotal", formatAudFromCents(input.subtotalCents)));
    rows.push(totalRow(`Promo code ${input.promoCode}`, `−${formatAudFromCents(discount)}`));
  }
  rows.push(totalRow("Total", `${formatAudFromCents(input.totalCents)} AUD`));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${rows.join("")}</table>`;
}

export function buildCustomerOrderEmail(input: OrderConfirmationInput): RenderedEmail {
  const amount = formatAudFromCents(input.totalCents);
  const name = customerName(input);
  const items = input.items.map(describeItem);
  const text = [
    `Order ${input.reference}`,
    "",
    `Hello ${name},`,
    "",
    shippingText(input.shipping),
    "",
    `Transfer ${amount} AUD for this order. Put the reference in the transfer description.`,
    "",
    "Items",
    ...items,
    "",
    totalsText(input),
    "",
    "How to pay",
    paymentInstructionsText(input),
    "",
    `Order page: ${input.orderUrl}`,
    "",
    RESEARCH_DISCLAIMER,
    "",
    `Questions about this order: ${COMPANY_EMAIL}`,
  ].join("\n");

  const html = htmlShell(
    `Order ${input.reference}`,
    `<p style="margin:0 0 12px;">Hello ${escapeHtml(name)},</p>
    ${shippingHtml(input.shipping)}
    <p style="margin:0 0 16px;">Transfer ${escapeHtml(amount)} AUD for this order. Put the reference in the transfer description.</p>
    ${itemsTable(input.items)}
    ${totalsHtml(input)}
    <p style="margin:20px 0 8px;color:#d4af37;font-size:12px;letter-spacing:0.12em;">HOW TO PAY</p>
    ${paymentInstructionsHtml(input)}
    <p style="margin:16px 0;"><a href="${escapeHtml(input.orderUrl)}" style="color:#d4af37;">View order ${escapeHtml(input.reference)}</a></p>
    <p style="margin:16px 0;color:#8f8c84;">${escapeHtml(RESEARCH_DISCLAIMER)}</p>
    <p style="margin:0;color:#8f8c84;">Questions about this order: <a href="mailto:${escapeHtml(COMPANY_EMAIL)}" style="color:#d4af37;">${escapeHtml(COMPANY_EMAIL)}</a></p>`,
  );

  return {
    to: singleLine(input.email),
    subject: singleLine(`Order ${input.reference} — ${amount} AUD awaiting payment`),
    text,
    html,
  };
}

export function buildMerchantOrderEmail(
  input: OrderConfirmationInput & { notifyEmail: string },
): RenderedEmail {
  const amount = formatAudFromCents(input.totalCents);
  const name = customerName(input);
  const lines = [
    `New order ${input.reference}`,
    "",
    `Customer: ${name}`,
    `Email: ${input.email}`,
    shippingText(input.shipping),
  ];
  if (input.promoCode) lines.push(`Promo code: ${input.promoCode}`);
  lines.push(
    "",
    "Items",
    ...input.items.map(describeItem),
    "",
    `Total: ${amount} AUD`,
    "",
    `Order page: ${input.orderUrl}`,
  );
  const text = lines.join("\n");

  const promoHtml = input.promoCode
    ? `<p style="margin:0 0 12px;">Promo code: ${escapeHtml(input.promoCode)}</p>`
    : "";
  const html = htmlShell(
    `New order ${input.reference}`,
    `<p style="margin:0 0 4px;">Customer: ${escapeHtml(name)}</p>
    <p style="margin:0 0 4px;">Email: ${escapeHtml(input.email)}</p>
    ${shippingHtml(input.shipping)}
    ${promoHtml}
    ${itemsTable(input.items)}
    <p style="margin:16px 0;color:#d4af37;">Total: ${escapeHtml(amount)} AUD</p>
    <p style="margin:0;"><a href="${escapeHtml(input.orderUrl)}" style="color:#d4af37;">Open order ${escapeHtml(input.reference)}</a></p>`,
  );

  return {
    to: singleLine(input.notifyEmail),
    subject: singleLine(`New order ${input.reference} — ${amount} AUD`),
    text,
    html,
  };
}

export function buildPaymentReceivedEmail(input: PaymentReceivedInput): RenderedEmail {
  const amount = formatAudFromCents(input.totalCents);
  const name = customerName(input);
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

  const html = htmlShell(
    `Payment received`,
    `<p style="margin:0 0 12px;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;">We have received ${escapeHtml(amount)} AUD for order ${escapeHtml(input.reference)}. It is queued for dispatch.</p>
    <p style="margin:0 0 16px;"><a href="${escapeHtml(input.orderUrl)}" style="color:#d4af37;">View order ${escapeHtml(input.reference)}</a></p>
    <p style="margin:0 0 12px;color:#8f8c84;">${escapeHtml(RESEARCH_DISCLAIMER)}</p>
    <p style="margin:0;color:#8f8c84;">Questions about this order: <a href="mailto:${escapeHtml(COMPANY_EMAIL)}" style="color:#d4af37;">${escapeHtml(COMPANY_EMAIL)}</a></p>`,
  );

  return {
    to: singleLine(input.email),
    subject: singleLine(`Payment received for order ${input.reference}`),
    text,
    html,
  };
}

/**
 * Sends one message through Resend's HTTP API.
 * A missing API key is a no-op: it logs once and never throws.
 * Transport failures throw so the caller can log them without failing checkout.
 */
function currentMailEnv(env?: MailEnv): MailEnv {
  if (env) return env;
  return {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ORDER_EMAIL_FROM: process.env.ORDER_EMAIL_FROM,
    ORDER_NOTIFY_EMAIL: process.env.ORDER_NOTIFY_EMAIL,
    PAYID_ADDRESS: process.env.PAYID_ADDRESS,
    PAYID_ACCOUNT_NAME: process.env.PAYID_ACCOUNT_NAME,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
}

export async function sendEmail(
  message: OutboundEmail,
  env?: MailEnv,
  hooks: MailHooks = {},
): Promise<void> {
  const resolved = currentMailEnv(env);
  const warn = hooks.warn ?? ((entry: string) => console.warn(entry));
  const apiKey = resolved.RESEND_API_KEY?.trim() ?? "";
  if (!apiKey) {
    noteOnce(
      "missing-api-key",
      "[mailer] RESEND_API_KEY is not set; transactional order emails are disabled",
      warn,
    );
    return;
  }

  const from = singleLine(resolved.ORDER_EMAIL_FROM ?? "");
  const to = singleLine(message.to);
  if (!from || !to) {
    noteOnce(
      "missing-from-or-to",
      "[mailer] ORDER_EMAIL_FROM or the recipient is missing; email skipped",
      warn,
    );
    return;
  }

  const fetchImpl = hooks.fetchImpl ?? fetch;
  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: singleLine(message.subject),
      text: message.text,
      html: message.html,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`Resend responded with HTTP ${response.status}`);
  }
}

function reportFailure(reference: string, error: unknown, hooks: MailHooks, label: string) {
  const detail = {
    reference,
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: publicErrorMessage(error),
  };
  if (hooks.onError) {
    hooks.onError(label, detail);
    return;
  }
  console.error(label, detail);
}

async function deliver(message: RenderedEmail, reference: string, env: MailEnv, hooks: MailHooks) {
  try {
    await sendEmail(message, env, hooks);
  } catch (error) {
    reportFailure(reference, error, hooks, "[mailer] send failed");
  }
}

export type OrderCreatedNotice = {
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  items: OrderEmailItem[];
  subtotalCents: number;
  totalCents: number;
  promoCode: string | null;
  shipping?: ShippingAddressView | null;
};

export async function sendOrderCreatedEmails(
  notice: OrderCreatedNotice,
  env?: MailEnv,
  hooks: MailHooks = {},
): Promise<void> {
  const resolved = currentMailEnv(env);
  const warn = hooks.warn ?? ((entry: string) => console.warn(entry));
  try {
    const bank = resolveBankTransfer(resolved);
    const confirmation: OrderConfirmationInput = {
      ...notice,
      payId: bank?.payId ?? "",
      accountName: bank?.accountName ?? "",
      orderUrl: orderPageUrl(notice.reference, resolved),
    };
    const jobs = [deliver(buildCustomerOrderEmail(confirmation), notice.reference, resolved, hooks)];
    const notifyEmail = merchantNotifyEmail(resolved);
    if (notifyEmail) {
      jobs.push(
        deliver(
          buildMerchantOrderEmail({ ...confirmation, notifyEmail }),
          notice.reference,
          resolved,
          hooks,
        ),
      );
    } else {
      noteOnce(
        "missing-notify",
        "[mailer] ORDER_NOTIFY_EMAIL and PAYID_ADDRESS are unset; merchant copy skipped",
        warn,
      );
    }
    await Promise.all(jobs);
  } catch (error) {
    reportFailure(notice.reference, error, hooks, "[mailer] order email failed");
  }
}

export async function sendPaymentReceivedEmail(
  notice: {
    reference: string;
    firstName: string;
    email: string;
    totalCents: number;
  },
  env?: MailEnv,
  hooks: MailHooks = {},
): Promise<void> {
  const resolved = currentMailEnv(env);
  try {
    const message = buildPaymentReceivedEmail({
      ...notice,
      orderUrl: orderPageUrl(notice.reference, resolved),
    });
    await deliver(message, notice.reference, resolved, hooks);
  } catch (error) {
    reportFailure(notice.reference, error, hooks, "[mailer] payment email failed");
  }
}
