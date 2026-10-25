"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { hashDistributionPassword, distributionCookieSecure, distributionSessionSecret, readDistributionSessionAccount } from "@/lib/distribution-auth";
import {
  authenticateDistributionAccount,
  createDistributionAccount,
  createDistributionQuote,
  distributionConfigured,
  DistributionForbiddenError,
  DistributionUnavailableError,
  findDistributionAccount,
} from "@/lib/distribution-db";
import {
  sendDistributionApplicationEmails,
  sendDistributionQuoteEmails,
} from "@/lib/distribution-mail";
import { clearDistributionSession, readDistributionSessionToken, setDistributionSession } from "@/lib/distribution-session";
import {
  applicationFromForm,
  boxOffers,
  distributionErrorMessage,
  parseQuoteRequest,
  type DistributionErrorCode,
} from "@/lib/distribution";
import { products } from "@/lib/products";
import { rateLimit } from "@/lib/rate-limit";
import { scheduleEmail } from "@/lib/schedule-email";

export type DistributionFormState = {
  error: string | null;
};

function clientIp(headerList: Headers) {
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
}

function failure(code: DistributionErrorCode): DistributionFormState {
  return { error: distributionErrorMessage(code) };
}

function secureCookie(headerList: Headers) {
  return distributionCookieSecure(headerList.get("x-forwarded-proto"));
}

export async function applyForDistribution(
  _previous: DistributionFormState,
  formData: FormData,
): Promise<DistributionFormState> {
  const parsed = applicationFromForm(formData);
  if (!parsed.ok) return failure(parsed.error);

  if (!distributionConfigured()) return failure("unavailable");

  const headerList = await headers();
  const ip = clientIp(headerList);
  const limit = rateLimit(`distribution-apply:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return failure("limited");

  try {
    const password = await hashDistributionPassword(parsed.password);
    const result = await createDistributionAccount(
      parsed.application,
      password.hash,
      password.salt,
    );
    if (!result.created || !result.account) return failure("exists");

    const account = result.account;
    scheduleEmail(account.email, () => sendDistributionApplicationEmails(account));
    const secret = distributionSessionSecret();
    if (secret) await setDistributionSession(account.id, secureCookie(headerList));
    revalidatePath("/admin/distribution");
    revalidatePath("/distribution");
  } catch (error) {
    console.error("[distribution] application failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return failure(error instanceof DistributionUnavailableError ? "unavailable" : "save");
  }

  redirect("/distribution?notice=applied", RedirectType.replace);
}

export async function loginDistribution(
  _previous: DistributionFormState,
  formData: FormData,
): Promise<DistributionFormState> {
  const headerList = await headers();
  const ip = clientIp(headerList);
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const limit = rateLimit(`distribution-login:${ip}:${email.trim().toLowerCase()}`, 8, 15 * 60 * 1000);
  if (!limit.ok) return failure("limited");
  if (!distributionSessionSecret()) return failure("unconfigured");

  try {
    const account = await authenticateDistributionAccount(email, password);
    if (!account) return failure("credentials");
    await setDistributionSession(account.id, secureCookie(headerList));
  } catch (error) {
    console.error("[distribution] sign-in failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return failure(error instanceof DistributionUnavailableError ? "unavailable" : "save");
  }

  redirect("/distribution", RedirectType.replace);
}

export async function logoutDistribution() {
  const headerList = await headers();
  await clearDistributionSession(secureCookie(headerList));
  redirect("/distribution?mode=login", RedirectType.replace);
}

export async function requestDistributionQuote(
  _previous: DistributionFormState,
  formData: FormData,
): Promise<DistributionFormState> {
  const secret = distributionSessionSecret();
  if (!secret) return failure("unconfigured");
  const token = await readDistributionSessionToken();
  const accountId = readDistributionSessionAccount(token, secret);
  if (!accountId) return failure("signin");

  const limit = rateLimit(`distribution-quote:${accountId}`, 20, 60 * 60 * 1000);
  if (!limit.ok) return failure("limited");

  const parsed = parseQuoteRequest(formData, boxOffers(products));
  if (!parsed.ok) return failure(parsed.error);

  let reference = "";
  try {
    const account = await findDistributionAccount(accountId);
    if (!account || account.status !== "approved") return failure("forbidden");
    const quote = await createDistributionQuote(
      account.id,
      parsed.lines,
      parsed.note,
      parsed.subtotalCents,
    );
    reference = quote.reference;
    scheduleEmail(quote.reference, () => sendDistributionQuoteEmails(quote));
  } catch (error) {
    console.error("[distribution] quote failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    if (error instanceof DistributionForbiddenError) return failure("forbidden");
    if (error instanceof DistributionUnavailableError) return failure("unavailable");
    return failure("save");
  }

  revalidatePath("/distribution");
  revalidatePath("/admin/distribution");
  redirect(
    `/distribution?notice=quoted&reference=${encodeURIComponent(reference)}`,
    RedirectType.replace,
  );
}
