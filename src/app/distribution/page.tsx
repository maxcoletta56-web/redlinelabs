import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { COMPANY_EMAIL } from "@/lib/company";
import { formatSydneyDateTime } from "@/lib/admin-orders";
import {
  distributionSessionSecret,
  readDistributionSessionAccount,
} from "@/lib/distribution-auth";
import {
  findDistributionAccount,
  listAccountDistributionQuotes,
  type DistributionAccount,
  type DistributionQuote,
} from "@/lib/distribution-db";
import { readDistributionSessionToken } from "@/lib/distribution-session";
import {
  boxOffers,
  distributionAccountStatusLabel,
  distributionPortalNotice,
  distributionQuoteStatusLabel,
  distributionRegionLabel,
  DISTRIBUTION_MIN_BOXES,
  DISTRIBUTION_UNITS_PER_BOX,
  quoteIsPriced,
  summarizeDistributionQuote,
} from "@/lib/distribution";
import { products, formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";
import { logoutDistribution } from "./actions";
import { ApplyForm } from "./apply-form";
import { LoginForm } from "./login-form";
import { QuoteForm } from "./quote-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Distribution",
  description:
    "Apply for a separate Redline Labs distribution account. Approved accounts request quotes at box prices, tracked apart from shop orders.",
  path: "/distribution",
  index: false,
});

type SearchParams = {
  mode?: string | string[];
  notice?: string | string[];
  reference?: string | string[];
};

function firstQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DistributionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [params, token] = await Promise.all([searchParams, readDistributionSessionToken()]);
  const notice = distributionPortalNotice(firstQuery(params.notice), firstQuery(params.reference));
  const mode = firstQuery(params.mode) === "login" ? "login" : "apply";
  const secret = distributionSessionSecret();
  const accountId = readDistributionSessionAccount(token, secret);

  if (!accountId) {
    return <SignedOut mode={mode} notice={notice} />;
  }

  let account: DistributionAccount | null = null;
  let quotes: DistributionQuote[] = [];
  let failed = false;
  try {
    account = await findDistributionAccount(accountId);
    if (account?.status === "approved") {
      quotes = await listAccountDistributionQuotes(account.id);
    }
  } catch (error) {
    failed = true;
    console.error("[distribution] portal failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }

  if (failed) return <LoadProblem />;
  if (!account) return <StaleSession notice={notice} />;
  return <SignedIn account={account} quotes={quotes} notice={notice} />;
}

function SignedOut({
  mode,
  notice,
}: {
  mode: "login" | "apply";
  notice: string | null;
}) {
  return (
    <div className="wrap py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Distribution" }]} />
      <ResearchDisclaimer className="mb-10" />
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="kicker mb-3">Distribution</p>
          <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em] text-white">
            A separate login for box quotes
          </h1>
          <p className="mb-6 max-w-xl text-[15px] leading-7 text-[#8f8c84]">
            Distribution accounts are not shop accounts. Apply with the business that will receive the supply.
            An application has to be approved before you can request a quote. Listed products show a price per box.
            Approved quotes are saved under their own references so they can be tracked apart from shop orders.
          </p>
          <ul className="space-y-3 text-sm leading-6 text-[#cfc8b8]">
            <li>Submit an application. Approval is selective.</li>
            <li>Sign in on this page. A shop sign-in does not open distribution quotes.</li>
            <li>
              Request at least {DISTRIBUTION_MIN_BOXES} boxes of each product. The box price is 10% off that item. It is
              not charged at shop checkout.
            </li>
          </ul>
        </div>
        <div className="surface p-6 sm:p-8">
          <div className="mb-6 flex gap-2">
            <Link
              href="/distribution"
              aria-current={mode === "apply" ? "page" : undefined}
              className={`flex-1 py-2 text-center text-[11px] font-semibold tracking-[0.12em] uppercase ${
                mode === "apply" ? "border-b-2 border-[#d4af37] text-[#d4af37]" : "text-[#8f8c84]"
              }`}
            >
              Apply
            </Link>
            <Link
              href="/distribution?mode=login"
              aria-current={mode === "login" ? "page" : undefined}
              className={`flex-1 py-2 text-center text-[11px] font-semibold tracking-[0.12em] uppercase ${
                mode === "login" ? "border-b-2 border-[#d4af37] text-[#d4af37]" : "text-[#8f8c84]"
              }`}
            >
              Sign in
            </Link>
          </div>
          {notice ? <Notice>{notice}</Notice> : null}
          {mode === "login" ? <LoginForm /> : <ApplyForm />}
        </div>
      </div>
    </div>
  );
}

function SignedIn({
  account,
  quotes,
  notice,
}: {
  account: DistributionAccount;
  quotes: DistributionQuote[];
  notice: string | null;
}) {
  return (
    <div className="wrap py-12 sm:py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Distribution" }]} />
      <ResearchDisclaimer className="mb-10" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <header>
          <p className="kicker mb-3">Distribution</p>
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">{account.businessName}</h1>
          <p className="mt-3 text-[15px] leading-7 text-[#8f8c84]">
            {account.contactName} · {account.email} · {distributionAccountStatusLabel(account.status)}
          </p>
        </header>
        <form action={logoutDistribution}>
          <button type="submit" className="btn-ghost min-h-11 w-full sm:w-auto">
            Log out
          </button>
        </form>
      </div>
      {notice ? <Notice>{notice}</Notice> : null}
      {account.status === "approved" ? (
        <ApprovedPortal account={account} quotes={quotes} />
      ) : (
        <PendingPortal account={account} />
      )}
    </div>
  );
}

function PendingPortal({ account }: { account: DistributionAccount }) {
  const rejected = account.status === "rejected";
  return (
    <section className="surface max-w-2xl p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-white">
        {rejected ? "Application not approved" : "Application awaiting approval"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#8f8c84]">
        {rejected
          ? "This distribution account cannot request quotes. Box prices stay hidden."
          : `Submitted ${formatSydneyDateTime(account.createdAt)} Melbourne time. Box prices stay hidden until this application is approved.`}
      </p>
      <dl className="mt-6 space-y-2 text-sm text-[#cfc8b8]">
        <div className="flex justify-between gap-4">
          <dt className="text-[#8f8c84]">Region</dt>
          <dd>{distributionRegionLabel(account.region)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#8f8c84]">Phone</dt>
          <dd>{account.phone}</dd>
        </div>
        {account.abn ? (
          <div className="flex justify-between gap-4">
            <dt className="text-[#8f8c84]">ABN</dt>
            <dd>{account.abn}</dd>
          </div>
        ) : null}
      </dl>
      {account.reviewNote ? (
        <p className="mt-6 text-sm leading-6 text-[#f3f1ea]">Note: {account.reviewNote}</p>
      ) : null}
      {rejected ? (
        <p className="mt-6 text-sm leading-6 text-[#8f8c84]">
          Questions: <a className="text-[#d4af37]" href={`mailto:${COMPANY_EMAIL}`}>{COMPANY_EMAIL}</a>
        </p>
      ) : null}
    </section>
  );
}

function ApprovedPortal({
  account,
  quotes,
}: {
  account: DistributionAccount;
  quotes: DistributionQuote[];
}) {
  const offers = boxOffers(products);
  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-xl font-semibold text-white">Request a box quote</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8f8c84]">
          {account.businessName} is approved. A box is {DISTRIBUTION_UNITS_PER_BOX} units, and each product needs at
          least {DISTRIBUTION_MIN_BOXES} boxes. The price on a listed product is 10% off that item. The discount is not
          taken off the order total. A saved quote is a request, not a shop order, and it is not paid here. Each quote
          gets a DQ reference so it can be tracked on the distribution desk.
        </p>
        <div className="mt-8">
          <QuoteForm offers={offers} minBoxes={DISTRIBUTION_MIN_BOXES} />
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">Your quotes</h2>
        <p className="mt-2 text-[12px] text-[#8f8c84]">Times are Melbourne time.</p>
        {quotes.length === 0 ? (
          <p className="mt-4 text-sm text-[#8f8c84]">No quotes yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {quotes.map((quote) => (
              <article key={quote.reference} className="surface p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{quote.reference}</h3>
                    <p className="mt-1 text-[12px] text-[#8f8c84]">{formatSydneyDateTime(quote.createdAt)} Melbourne time</p>
                  </div>
                  <p className="text-sm text-[#d4af37]">
                    {distributionQuoteStatusLabel(quote.status)}
                    {" · "}
                    {quoteIsPriced(quote.lines) ? formatPrice(quote.subtotalCents / 100) : "Price not set"}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#cfc8b8]">{summarizeDistributionQuote(quote.lines)}</p>
                {quote.note ? <p className="mt-2 text-sm text-[#8f8c84]">Your note: {quote.note}</p> : null}
                {quote.adminNote ? <p className="mt-2 text-sm text-[#f3f1ea]">Note: {quote.adminNote}</p> : null}
                <ul className="mt-4 space-y-2 text-sm text-[#cfc8b8]">
                  {quote.lines.map((line) => (
                    <li key={`${quote.reference}-${line.sku}`} className="flex justify-between gap-4">
                      <span>
                        {line.boxes} box × {line.name} {line.option}
                      </span>
                      <span>{line.boxCents > 0 ? formatPrice(line.lineCents / 100) : "Price not set"}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LoadProblem() {
  return (
    <div className="wrap py-16">
      <p className="kicker mb-3">Distribution</p>
      <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Could not load this account</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[#8f8c84]">
        The distribution desk could not be read. Try again, or log out and sign in later.
      </p>
      <form action={logoutDistribution} className="mt-6">
        <button type="submit" className="btn min-h-11">
          Log out
        </button>
      </form>
    </div>
  );
}

function StaleSession({ notice }: { notice: string | null }) {
  return (
    <div className="wrap py-16">
      <p className="kicker mb-3">Distribution</p>
      <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Sign in again</h1>
      {notice ? <Notice>{notice}</Notice> : null}
      <p className="mt-4 max-w-xl text-sm leading-6 text-[#8f8c84]">This distribution sign-in is no longer valid.</p>
      <form action={logoutDistribution} className="mt-6">
        <button type="submit" className="btn min-h-11">
          Back to sign in
        </button>
      </form>
    </div>
  );
}

function Notice({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="mb-6 border border-[rgba(212,175,55,0.34)] bg-[rgba(212,175,55,0.08)] px-4 py-3 text-sm leading-6 text-[#f3f1ea]"
    >
      {children}
    </p>
  );
}
