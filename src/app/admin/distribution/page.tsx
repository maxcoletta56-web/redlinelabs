import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { loginAdmin, logoutAdmin } from "@/app/admin/orders/actions";
import { Field } from "@/components/Field";
import {
  adminLoginError,
  customerEmailHref,
  firstQueryValue,
  formatAudCents,
  formatSydneyDateTime,
  gateAdminData,
} from "@/lib/admin-orders";
import { readAdminSessionToken } from "@/lib/admin-session";
import {
  distributionConfigured,
  listDistributionAccounts,
  listDistributionQuotes,
  type DistributionAccount,
  type DistributionQuote,
} from "@/lib/distribution-db";
import { priceFieldName } from "@/lib/distribution-fields";
import {
  distributionAccountStatusLabel,
  distributionAdminNotice,
  distributionDeskStats,
  distributionQuoteStatusLabel,
  distributionRegionLabel,
  DISTRIBUTION_MIN_BOXES,
  DISTRIBUTION_UNITS_PER_BOX,
  quoteIsPriced,
  summarizeDistributionQuote,
} from "@/lib/distribution";
import { pageMetadata } from "@/lib/seo";
import {
  reviewDistributionAccountAction,
  reviewDistributionQuoteAction,
  saveDistributionQuotePricesAction,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Distribution",
  description: "Private desk for distribution applications and box quotes. This page is not indexed.",
  path: "/admin/distribution",
  index: false,
});

type SearchParams = {
  error?: string | string[];
  notice?: string | string[];
  reference?: string | string[];
};

type LoadResult = {
  accounts: DistributionAccount[];
  quotes: DistributionQuote[];
  problem: "unavailable" | "failed" | null;
};

export default async function AdminDistributionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [token, params] = await Promise.all([readAdminSessionToken(), searchParams]);
  const gate = await gateAdminData(token, process.env.ADMIN_API_SECRET, loadDesk);
  const notice = distributionAdminNotice(firstQueryValue(params.notice), firstQueryValue(params.reference));

  if (!gate.authorized) {
    return <AdminLogin message={adminLoginError(firstQueryValue(params.error))} />;
  }

  return <Desk accounts={gate.data.accounts} quotes={gate.data.quotes} problem={gate.data.problem} notice={notice} />;
}

async function loadDesk(): Promise<LoadResult> {
  if (!distributionConfigured()) return { accounts: [], quotes: [], problem: "unavailable" };
  try {
    const [accounts, quotes] = await Promise.all([listDistributionAccounts(), listDistributionQuotes()]);
    return { accounts, quotes, problem: null };
  } catch (error) {
    console.error("[admin] list distribution failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { accounts: [], quotes: [], problem: "failed" };
  }
}

function AdminLogin({ message }: { message: string | null }) {
  return (
    <div className="wrap py-10 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="kicker mb-3">Admin</p>
        <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Distribution</h1>
        <p className="mt-3 text-[15px] leading-7 text-[#8f8c84]">
          Enter the admin secret to review applications and box quotes.
        </p>
        <form action={loginAdmin} className="surface mt-8 space-y-4 p-5 sm:p-6">
          <input type="hidden" name="next" value="/admin/distribution" />
          {message ? (
            <p role="alert" className="text-sm leading-6 text-[#d4af37]">
              {message}
            </p>
          ) : null}
          <Field
            id="admin-secret"
            name="secret"
            label="Admin secret"
            type="password"
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
          <button type="submit" className="btn min-h-11 w-full">
            Unlock distribution
          </button>
        </form>
      </div>
    </div>
  );
}

function Desk({
  accounts,
  quotes,
  problem,
  notice,
}: {
  accounts: DistributionAccount[];
  quotes: DistributionQuote[];
  problem: LoadResult["problem"];
  notice: string | null;
}) {
  const stats = distributionDeskStats(accounts, quotes);
  const quoteCount = new Map<string, number>();
  for (const quote of quotes) quoteCount.set(quote.accountId, (quoteCount.get(quote.accountId) ?? 0) + 1);
  const problemText =
    problem === "unavailable"
      ? "Distribution records are unavailable until the database is configured."
      : problem === "failed"
        ? "Could not list distribution records."
        : null;

  return (
    <div className="wrap py-10 sm:py-16">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <header>
          <p className="kicker mb-3">Admin</p>
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Distribution</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#8f8c84]">
            Applications and box quotes, separate from shop orders. Approved accounts request at least{" "}
            {DISTRIBUTION_MIN_BOXES} boxes of {DISTRIBUTION_UNITS_PER_BOX} units. Listed products already carry a box
            price, and you can change it on the quote. A quote is a request, not a payment.
          </p>
        </header>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/admin/orders" className="btn-ghost min-h-11 w-full sm:w-auto">
            Orders
          </Link>
          <form action={logoutAdmin}>
            <input type="hidden" name="next" value="/admin/distribution" />
            <button type="submit" className="btn-ghost min-h-11 w-full sm:w-auto">
              Log out
            </button>
          </form>
        </div>
      </div>

      {notice ? (
        <p role="status" className="mb-6 border border-[rgba(212,175,55,0.34)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm leading-6 text-[#f3f1ea]">
          {notice}
        </p>
      ) : null}
      {problemText ? (
        <p role="alert" className="mb-6 border border-[rgba(212,175,55,0.34)] px-4 py-3 text-sm text-[#d4af37]">
          {problemText}
        </p>
      ) : (
        <section aria-label="Distribution counts" className="mb-8">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Awaiting approval" value={String(stats.pending)} />
            <Stat label="Approved" value={String(stats.approved)} />
            <Stat label="Awaiting price" value={String(stats.awaitingPrice)} />
            <Stat label="Priced quotes" value={String(stats.pricedQuotes)} />
            <Stat label="Priced value" value={formatAudCents(stats.pricedCents)} />
          </dl>
          <p className="mt-3 text-[12px] leading-5 text-[#8f8c84]">
            Latest 200 accounts and quotes. Times are Melbourne time.
          </p>
        </section>
      )}

      {problem ? null : (
        <>
          <h2 className="mb-4 text-xl font-semibold text-white">Applications</h2>
          <div className="surface mb-12 overflow-x-auto">
            <table className="block w-full text-left md:table md:min-w-[1100px]">
              <caption className="sr-only">Distribution applications</caption>
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-[rgba(212,175,55,0.16)] text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                  <th className="px-4 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Applied</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Quotes</th>
                  <th className="px-4 py-3 font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {accounts.length === 0 ? (
                  <tr className="block md:table-row">
                    <td className="block px-4 py-6 text-sm text-[#8f8c84] md:table-cell" colSpan={5}>
                      No applications yet.
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr key={account.id} className="block border-b border-[rgba(212,175,55,0.16)] md:table-row">
                      <Cell label="Business">
                        <p className="font-medium text-white">{account.businessName}</p>
                        <p className="mt-1 text-[#cfc8b8]">{account.contactName}</p>
                        <AccountEmail email={account.email} />
                        <p className="mt-1 text-[12px] text-[#8f8c84]">
                          {account.phone} · {distributionRegionLabel(account.region)}
                          {account.abn ? ` · ABN ${account.abn}` : ""}
                        </p>
                        {account.website ? <p className="mt-1 text-[12px] text-[#8f8c84]">{account.website}</p> : null}
                        {account.message ? <p className="mt-2 max-w-sm text-[13px] leading-5 text-[#cfc8b8]">{account.message}</p> : null}
                      </Cell>
                      <Cell label="Applied">{formatSydneyDateTime(account.createdAt)} Melbourne time</Cell>
                      <Cell label="Status">
                        <StatusBadge label={distributionAccountStatusLabel(account.status)} quiet={account.status === "rejected"} />
                        {account.reviewNote ? <p className="mt-2 max-w-xs text-[12px] text-[#cfc8b8]">{account.reviewNote}</p> : null}
                      </Cell>
                      <Cell label="Quotes">{String(quoteCount.get(account.id) ?? 0)}</Cell>
                      <Cell label="Review">
                        <ReviewAccount account={account} />
                      </Cell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mb-4 text-xl font-semibold text-white">Quotes</h2>
          <div className="surface overflow-x-auto">
            <table className="block w-full text-left md:table md:min-w-[1100px]">
              <caption className="sr-only">Distribution quotes</caption>
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-[rgba(212,175,55,0.16)] text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Requested</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold">Quote</th>
                  <th className="px-4 py-3 font-semibold">Update</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {quotes.length === 0 ? (
                  <tr className="block md:table-row">
                    <td className="block px-4 py-6 text-sm text-[#8f8c84] md:table-cell" colSpan={5}>
                      No quotes yet.
                    </td>
                  </tr>
                ) : (
                  quotes.map((quote) => (
                    <tr key={quote.reference} id={`quote-${quote.reference}`} className="block border-b border-[rgba(212,175,55,0.16)] md:table-row">
                      <Cell label="Reference">
                        <p className="font-medium text-white">{quote.reference}</p>
                        <p className="mt-1">
                          <StatusBadge label={distributionQuoteStatusLabel(quote.status)} quiet={quote.status === "declined"} />
                        </p>
                      </Cell>
                      <Cell label="Requested">{formatSydneyDateTime(quote.createdAt)} Melbourne time</Cell>
                      <Cell label="Account">
                        <p className="text-white">{quote.businessName}</p>
                        <p className="mt-1 text-[#cfc8b8]">{quote.contactName}</p>
                        <AccountEmail email={quote.email} />
                      </Cell>
                      <Cell label="Quote">
                        <p className="text-white">
                          {quoteIsPriced(quote.lines) ? formatAudCents(quote.subtotalCents) : "Price not set"}
                        </p>
                        <p className="mt-1 max-w-sm text-[13px] leading-5 text-[#cfc8b8]">{summarizeDistributionQuote(quote.lines)}</p>
                        {quote.note ? <p className="mt-2 text-[12px] text-[#8f8c84]">Applicant note: {quote.note}</p> : null}
                        {quote.adminNote ? <p className="mt-2 text-[12px] text-[#cfc8b8]">Note: {quote.adminNote}</p> : null}
                        <ul className="mt-2 space-y-1 text-[12px] text-[#8f8c84]">
                          {quote.lines.map((line) => (
                            <li key={`${quote.reference}-${line.sku}`}>
                              {line.boxes} × {line.sku} · retail {formatAudCents(line.retailUnitCents)} each
                              {line.boxCents > 0 ? ` · ${formatAudCents(line.lineCents)}` : " · Price not set"}
                            </li>
                          ))}
                        </ul>
                      </Cell>
                      <Cell label="Update">
                        <div className="flex max-w-xs flex-col gap-4">
                          <PriceQuote quote={quote} />
                          <ReviewQuote quote={quote} />
                        </div>
                      </Cell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewAccount({ account }: { account: DistributionAccount }) {
  return (
    <div className="flex max-w-xs flex-col gap-3">
      {account.status !== "approved" ? (
        <form action={reviewDistributionAccountAction}>
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="status" value="approved" />
          <button type="submit" className="btn min-h-11 w-full">
            Approve
          </button>
        </form>
      ) : null}
      {account.status !== "rejected" ? (
        <form action={reviewDistributionAccountAction} className="space-y-2">
          <input type="hidden" name="id" value={account.id} />
          <input type="hidden" name="status" value="rejected" />
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
              Note to the applicant
            </span>
            <input name="reviewNote" className="field" maxLength={500} defaultValue={account.reviewNote} />
          </label>
          <button type="submit" className="btn-ghost min-h-11 w-full">
            {account.status === "approved" ? "Remove approval" : "Do not approve"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function PriceQuote({ quote }: { quote: DistributionQuote }) {
  if (quote.status === "declined" || quote.lines.length === 0) return null;
  return (
    <form action={saveDistributionQuotePricesAction} className="space-y-3">
      <input type="hidden" name="reference" value={quote.reference} />
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">Box price (AUD)</p>
      {quote.lines.map((line) => (
        <label key={line.sku} className="block">
          <span className="mb-2 block text-[12px] leading-5 text-[#cfc8b8]">
            {line.sku} · {line.boxes} {line.boxes === 1 ? "box" : "boxes"}
          </span>
          <input
            name={priceFieldName(line.sku)}
            className="field"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            defaultValue={line.boxCents > 0 ? (line.boxCents / 100).toFixed(2) : ""}
            aria-label={`Box price for ${line.sku}`}
            required
          />
        </label>
      ))}
      <button type="submit" className="btn min-h-11 w-full">
        Save box prices
      </button>
    </form>
  );
}

function ReviewQuote({ quote }: { quote: DistributionQuote }) {
  return (
    <form action={reviewDistributionQuoteAction} className="max-w-xs space-y-2">
      <input type="hidden" name="reference" value={quote.reference} />
      <label className="block">
        <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
          Note visible on the quote
        </span>
        <input name="adminNote" className="field" maxLength={500} defaultValue={quote.adminNote} />
      </label>
      {quote.status !== "accepted" ? (
        <button type="submit" name="status" value="accepted" className="btn min-h-11 w-full">
          Accept quote
        </button>
      ) : null}
      {quote.status !== "declined" ? (
        <button type="submit" name="status" value="declined" className="btn-ghost min-h-11 w-full">
          Decline quote
        </button>
      ) : null}
    </form>
  );
}

function AccountEmail({ email }: { email: string }) {
  const href = customerEmailHref(email);
  if (!href) return <p className="mt-1 text-[12px] text-[#8f8c84]">{email}</p>;
  return (
    <a href={href} className="mt-1 block text-[12px] text-[#d4af37] hover:text-white">
      {email}
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface px-4 py-3">
      <dt className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <td className="block py-1.5 align-top text-sm md:table-cell md:px-4 md:py-4">
      <span className="mb-1 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase md:hidden">
        {label}
      </span>
      {children}
    </td>
  );
}

function StatusBadge({ label, quiet }: { label: string; quiet?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ${
        quiet
          ? "border border-white/15 text-[#8f8c84]"
          : "border border-[#d4af37] bg-[rgba(212,175,55,0.14)] text-[#d4af37]"
      }`}
    >
      {label}
    </span>
  );
}
