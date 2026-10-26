import { COMPANY_EMAIL, RESEARCH_DISCLAIMER } from "./company.ts";
import type { DistributionAccount, DistributionQuote } from "./distribution-db.ts";
import {
  DISTRIBUTION_MIN_BOXES,
  DISTRIBUTION_UNITS_PER_BOX,
  distributionQuoteStatusLabel,
  distributionRegionLabel,
  quoteIsPriced,
} from "./distribution.ts";
import { formatAudFromCents, merchantNotifyEmail, sendEmail, type MailEnv } from "./mailer.ts";

type ApplicationNotice = Pick<
  DistributionAccount,
  "businessName" | "contactName" | "email" | "phone" | "abn" | "region" | "website" | "message"
>;

function siteBase(env: MailEnv) {
  return (env.NEXT_PUBLIC_SITE_URL?.trim() || "https://redlinelabs.shop").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function paragraph(text: string) {
  return `<p style="margin:0 0 12px;color:#f3f1ea;">${escapeHtml(text)}</p>`;
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
              REDLINE LABS DISTRIBUTION
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

function quoteLinesText(quote: DistributionQuote) {
  const priced = quoteIsPriced(quote.lines);
  const lines = quote.lines.map((line) => {
    const amount =
      line.boxCents > 0
        ? `${formatAudFromCents(line.boxCents)} per box, ${formatAudFromCents(line.lineCents)}`
        : "box price not set yet";
    return `${line.boxes} box × ${line.name} ${line.option} (${line.sku}) — ${amount}`;
  });
  return [
    ...lines,
    "",
    priced ? `Quoted total: ${formatAudFromCents(quote.subtotalCents)} AUD` : "Box price not set yet.",
    quote.note ? `Note: ${quote.note}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildDistributionApplicationEmails(application: ApplicationNotice, env: MailEnv = {}) {
  const portal = `${siteBase(env)}/distribution`;
  const desk = `${siteBase(env)}/admin/distribution`;
  const applicantText = [
    `Hello ${application.contactName},`,
    "",
    `We have the distribution application for ${application.businessName}.`,
    "Box prices stay hidden until the application is approved.",
    "This login is separate from a shop account.",
    "",
    `Check the status: ${portal}`,
    "",
    RESEARCH_DISCLAIMER,
  ].join("\n");

  const merchantLines = [
    `Business: ${application.businessName}`,
    `Contact: ${application.contactName}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `ABN: ${application.abn || "—"}`,
    `Region: ${distributionRegionLabel(application.region)}`,
    `Website: ${application.website || "—"}`,
    application.message ? `Note: ${application.message}` : "",
    "",
    `Review: ${desk}`,
  ].filter((line) => line !== "");

  return {
    applicant: {
      to: application.email,
      subject: "Distribution application received",
      text: applicantText,
      html: htmlShell(
        "Application received",
        `${paragraph(`Hello ${application.contactName},`)}
        ${paragraph(`We have the distribution application for ${application.businessName}.`)}
        ${paragraph("Box prices stay hidden until the application is approved. This login is separate from a shop account.")}
        ${paragraph(`Check the status: ${portal}`)}
        ${paragraph(RESEARCH_DISCLAIMER)}`,
      ),
    },
    merchant: {
      to: merchantNotifyEmail(env),
      subject: `Distribution application — ${singleLine(application.businessName)}`,
      text: merchantLines.join("\n"),
      html: htmlShell(
        "New distribution application",
        merchantLines.map((line) => paragraph(line)).join(""),
      ),
    },
  };
}

export function buildDistributionDecisionEmail(
  account: Pick<DistributionAccount, "contactName" | "email" | "businessName" | "status" | "reviewNote">,
  env: MailEnv = {},
) {
  const portal = `${siteBase(env)}/distribution`;
  const approved = account.status === "approved";
  const heading = approved ? "Distribution account approved" : "Distribution application not approved";
  const detail = approved
    ? `Sign in at ${portal} to request a quote. Each box is ${DISTRIBUTION_UNITS_PER_BOX} units, and each product needs at least ${DISTRIBUTION_MIN_BOXES} boxes. Listed products show the distributor price per box. Quotes are tracked separately from shop orders.`
    : `The application for ${account.businessName} was not approved. Box prices stay hidden.`;
  const note = account.reviewNote ? `Note: ${account.reviewNote}` : "";
  const text = [
    `Hello ${account.contactName},`,
    "",
    detail,
    note,
    approved ? "" : `Questions: ${COMPANY_EMAIL}`,
    "",
    RESEARCH_DISCLAIMER,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return {
    to: account.email,
    subject: heading,
    text,
    html: htmlShell(
      heading,
      `${paragraph(`Hello ${account.contactName},`)}
      ${paragraph(detail)}
      ${note ? paragraph(note) : ""}
      ${approved ? "" : paragraph(`Questions: ${COMPANY_EMAIL}`)}
      ${paragraph(RESEARCH_DISCLAIMER)}`,
    ),
  };
}

export function buildDistributionQuoteEmails(quote: DistributionQuote, env: MailEnv = {}) {
  const portal = `${siteBase(env)}/distribution`;
  const desk = `${siteBase(env)}/admin/distribution`;
  const lines = quoteLinesText(quote);
  const applicantText = [
    `Hello ${quote.contactName || "there"},`,
    "",
    `Quote ${quote.reference} is saved for ${quote.businessName || "your account"}.`,
    "This is a quote request. It is not a shop order and it has not been paid.",
    "",
    lines,
    "",
    `Track it: ${portal}`,
    "",
    RESEARCH_DISCLAIMER,
  ].join("\n");
  const merchantText = [
    `Quote ${quote.reference}`,
    `Business: ${quote.businessName}`,
    `Contact: ${quote.contactName}`,
    `Email: ${quote.email}`,
    "",
    lines,
    "",
    `Track it: ${desk}`,
  ].join("\n");
  return {
    applicant: {
      to: quote.email,
      subject: `Distribution quote ${quote.reference}`,
      text: applicantText,
      html: htmlShell(`Quote ${quote.reference}`, applicantText.split("\n").map((line) => paragraph(line || " ")).join("")),
    },
    merchant: {
      to: merchantNotifyEmail(env),
      subject: `Distribution quote ${quote.reference}`,
      text: merchantText,
      html: htmlShell(`Quote ${quote.reference}`, merchantText.split("\n").map((line) => paragraph(line || " ")).join("")),
    },
  };
}

export function buildDistributionQuotePricedEmail(quote: DistributionQuote, env: MailEnv = {}) {
  const portal = `${siteBase(env)}/distribution`;
  const lines = quoteLinesText(quote);
  const text = [
    `Hello ${quote.contactName || "there"},`,
    "",
    `Quote ${quote.reference} now has a box price.`,
    "This is still a quote. It is not a shop order and it has not been paid.",
    "",
    lines,
    "",
    `Track it: ${portal}`,
    "",
    RESEARCH_DISCLAIMER,
  ].join("\n");
  return {
    to: quote.email,
    subject: `Distribution quote ${quote.reference} priced`,
    text,
    html: htmlShell(`Quote ${quote.reference}`, text.split("\n").map((line) => paragraph(line || " ")).join("")),
  };
}

export function buildDistributionQuoteDecisionEmail(
  quote: DistributionQuote,
  env: MailEnv = {},
) {
  const portal = `${siteBase(env)}/distribution`;
  const status = distributionQuoteStatusLabel(quote.status);
  const text = [
    `Hello ${quote.contactName || "there"},`,
    "",
    `Quote ${quote.reference} is now ${status.toLowerCase()}.`,
    quoteIsPriced(quote.lines)
      ? `Quoted total: ${formatAudFromCents(quote.subtotalCents)} AUD`
      : "Box price was not set.",
    quote.adminNote ? `Note: ${quote.adminNote}` : "",
    "",
    `Track it: ${portal}`,
    "",
    RESEARCH_DISCLAIMER,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return {
    to: quote.email,
    subject: `Distribution quote ${quote.reference} ${status.toLowerCase()}`,
    text,
    html: htmlShell(`Quote ${quote.reference}`, text.split("\n").map((line) => paragraph(line || " ")).join("")),
  };
}

export async function sendDistributionApplicationEmails(application: ApplicationNotice, env?: MailEnv) {
  const messages = buildDistributionApplicationEmails(application, env);
  await sendEmail(messages.applicant, env);
  if (messages.merchant.to) await sendEmail(messages.merchant, env);
}

export async function sendDistributionDecisionEmail(
  account: Pick<DistributionAccount, "contactName" | "email" | "businessName" | "status" | "reviewNote">,
  env?: MailEnv,
) {
  await sendEmail(buildDistributionDecisionEmail(account, env), env);
}

export async function sendDistributionQuoteEmails(quote: DistributionQuote, env?: MailEnv) {
  const messages = buildDistributionQuoteEmails(quote, env);
  if (messages.applicant.to) await sendEmail(messages.applicant, env);
  if (messages.merchant.to) await sendEmail(messages.merchant, env);
}

export async function sendDistributionQuotePricedEmail(quote: DistributionQuote, env?: MailEnv) {
  if (!quote.email) return;
  await sendEmail(buildDistributionQuotePricedEmail(quote, env), env);
}

export async function sendDistributionQuoteDecisionEmail(quote: DistributionQuote, env?: MailEnv) {
  if (!quote.email) return;
  await sendEmail(buildDistributionQuoteDecisionEmail(quote, env), env);
}
