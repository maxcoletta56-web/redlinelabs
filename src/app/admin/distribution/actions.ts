"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { adminSessionValid } from "@/lib/admin-auth";
import { readAdminSessionToken } from "@/lib/admin-session";
import {
  DistributionUnavailableError,
  findDistributionAccount,
  listDistributionQuotes,
  reviewDistributionAccount,
  reviewDistributionQuote,
  saveDistributionQuotePrices,
} from "@/lib/distribution-db";
import {
  sendDistributionDecisionEmail,
  sendDistributionQuoteDecisionEmail,
  sendDistributionQuotePricedEmail,
} from "@/lib/distribution-mail";
import {
  DISTRIBUTION_ACCOUNT_STATUSES,
  DISTRIBUTION_QUOTE_STATUSES,
  applyQuotePrices,
  cleanReviewNote,
  normalizeDistributionQuoteReference,
  quoteIsPriced,
  type DistributionAccountStatus,
  type DistributionQuoteStatus,
} from "@/lib/distribution";
import { scheduleEmail } from "@/lib/schedule-email";

function signedOut() {
  redirect("/admin/distribution?error=signed-out", RedirectType.replace);
}

async function requireAdmin() {
  const token = await readAdminSessionToken();
  if (!adminSessionValid(token, process.env.ADMIN_API_SECRET)) signedOut();
}

export async function reviewDistributionAccountAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reviewNote = cleanReviewNote(formData.get("reviewNote"));
  if (!/^[0-9a-f-]{36}$/i.test(id) || reviewNote === null) {
    redirect("/admin/distribution?notice=invalid", RedirectType.replace);
  }
  if (!(DISTRIBUTION_ACCOUNT_STATUSES as readonly string[]).includes(status)) {
    redirect("/admin/distribution?notice=invalid", RedirectType.replace);
  }

  let notice = status === "approved" ? "approved" : "rejected";
  try {
    const existing = await findDistributionAccount(id);
    if (!existing) {
      notice = "missing";
    } else {
      const updated = await reviewDistributionAccount(id, status as DistributionAccountStatus, reviewNote);
      if (!updated) notice = "missing";
      else if (existing.status !== updated.status) {
        scheduleEmail(updated.email, () => sendDistributionDecisionEmail(updated));
      }
    }
  } catch (error) {
    console.error("[distribution] review account failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    notice = error instanceof DistributionUnavailableError ? "unavailable" : "failed";
  }

  revalidatePath("/admin/distribution");
  revalidatePath("/distribution");
  redirect(`/admin/distribution?notice=${notice}`, RedirectType.replace);
}

export async function reviewDistributionQuoteAction(formData: FormData) {
  await requireAdmin();
  const reference = normalizeDistributionQuoteReference(String(formData.get("reference") ?? ""));
  const status = String(formData.get("status") ?? "");
  const adminNote = cleanReviewNote(formData.get("adminNote"));
  if (!reference || adminNote === null) {
    redirect("/admin/distribution?notice=invalid", RedirectType.replace);
  }
  if (!(DISTRIBUTION_QUOTE_STATUSES as readonly string[]).includes(status)) {
    redirect("/admin/distribution?notice=invalid", RedirectType.replace);
  }

  let notice = status === "accepted" ? "accepted" : "declined";
  try {
    const existing = (await listDistributionQuotes()).find((quote) => quote.reference === reference);
    if (!existing) {
      notice = "missing";
    } else if (status === "accepted" && !quoteIsPriced(existing.lines)) {
      notice = "unpriced";
    } else {
      const updated = await reviewDistributionQuote(reference, status as DistributionQuoteStatus, adminNote);
      if (!updated) notice = "missing";
      else if (existing.status !== updated.status) {
        scheduleEmail(updated.reference, () =>
          sendDistributionQuoteDecisionEmail({
            ...updated,
            businessName: updated.businessName || existing.businessName,
            contactName: updated.contactName || existing.contactName,
            email: updated.email || existing.email,
          }),
        );
      }
    }
  } catch (error) {
    console.error("[distribution] review quote failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    notice = error instanceof DistributionUnavailableError ? "unavailable" : "failed";
  }

  revalidatePath("/admin/distribution");
  revalidatePath("/distribution");
  redirect(
    `/admin/distribution?notice=${notice}&reference=${encodeURIComponent(reference)}`,
    RedirectType.replace,
  );
}

export async function saveDistributionQuotePricesAction(formData: FormData) {
  await requireAdmin();
  const reference = normalizeDistributionQuoteReference(String(formData.get("reference") ?? ""));
  if (!reference) {
    redirect("/admin/distribution?notice=invalid", RedirectType.replace);
  }

  let notice = "priced";
  try {
    const existing = (await listDistributionQuotes()).find((quote) => quote.reference === reference);
    if (!existing) {
      notice = "missing";
    } else if (existing.status === "declined") {
      notice = "invalid";
    } else {
      const priced = applyQuotePrices(existing.lines, formData);
      if (!priced.ok) {
        notice = "price";
      } else {
        const updated = await saveDistributionQuotePrices(reference, priced.lines, priced.subtotalCents);
        if (!updated) {
          notice = "missing";
        } else {
          scheduleEmail(`${updated.reference}:priced`, () =>
            sendDistributionQuotePricedEmail({
              ...updated,
              businessName: updated.businessName || existing.businessName,
              contactName: updated.contactName || existing.contactName,
              email: updated.email || existing.email,
            }),
          );
        }
      }
    }
  } catch (error) {
    console.error("[distribution] save quote prices failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    notice = error instanceof DistributionUnavailableError ? "unavailable" : "failed";
  }

  revalidatePath("/admin/distribution");
  revalidatePath("/distribution");
  redirect(
    `/admin/distribution?notice=${notice}&reference=${encodeURIComponent(reference)}`,
    RedirectType.replace,
  );
}
