# Redline Club v1

Redline Club is an optional points programme. It has no logins, sessions, point
expiry or referral bonuses in v1. Every Club surface carries the research-use
disclaimer (`ResearchDisclaimer`) and uses no health or wellness language.

**Status: built, but earning and redemption are OFF.** Tier names and
lifetime-spend thresholds are confirmed (AUD): Member from $0, Silver from $500,
Gold from $1,000, VIP from $2,000 (0 / 50,000 / 100,000 / 200,000 cents). These
override the reference screenshots' $0 / $1,000 / $2,500 / $5,000 thresholds and
are in `CLUB_PROGRAM` in `src/lib/club.ts`. Earning rates, the points-to-dollars
conversion, `earningStartsAt` and the `approved` flag have not been supplied, so
they are not invented: they stay `null` / `false` and the programme is inactive.
Joining works; points are neither earned nor spent until the decisions below are
made. No screenshot was supplied and none is claimed to be matched; the pages
reuse the existing dark/gold styling.

## Outstanding decisions (needed before anything is earned)

Fill these in `CLUB_PROGRAM` (`src/lib/club.ts`) and set `approved: true` in the
same change. `validateClubProgram` refuses a partial or inconsistent set and
`activeClubProgram()` stays `null`, so a half-finished edit cannot turn earning on.

| Decision | Field | Notes |
| --- | --- | --- |
| Four tier names | `tiers[n].name` | **Done**: Member, Silver, Gold, VIP |
| Lifetime-spend threshold per tier | `tiers[n].fromCents` | **Done**: 0 / 50,000 / 100,000 / 200,000 cents |
| Earn rate per tier | `tiers[n].earnBasis` | Points per dollar x 100, so `100` = 1 point per $1 paid |
| Dollar value of 100 points | `centsPerRedeemBlock` | e.g. `500` would make 100 points = $5.00 |
| First date points can be earned | `earningStartsAt` | ISO date. Orders paid earlier never earn, including on reconcile |
| Sign-off | `approved` | `true` only once every value above is signed off |

Fixed by the brief: redemption in multiples of 100 points (`REDEEM_STEP_POINTS`)
and at least AUD $1.00 payable (`MIN_PAYABLE_CENTS`). No join bonus or
first-order bonus exists any more, because those were invented values. Legacy
`join` / `first_order` ledger rows still display.

The unit tests use clearly synthetic values from `src/lib/club-test-fixtures.ts`.
They are not a proposal and are never imported by application code.

## What was audited

The first Club implementation (PR #107) already existed. It stored member codes
in plaintext, used invented rates (5c per point, four named tiers, join and
first-order bonuses), did multi-statement non-atomic accounting, awarded only on
the first paid transition, had no cancel/release, and had no rate limiting on
checkout credential checks. This change reworks it in place instead of adding a
parallel system. The repo's Next.js docs in `node_modules/next/dist/docs` were
not needed beyond existing patterns.

## Design

* **Identity.** Email is normalised (trim, lower case). Email alone identifies
  *earnings*. Email plus member code authorises *balance lookup and redemption*.
* **Member codes.** `RL-` plus 10 characters from a 25-character alphabet drawn
  with rejection sampling from `crypto.getRandomValues`. Only an HMAC-SHA256 of
  the normalised code under `CLUB_CODE_SECRET` is stored (`member_code_hash`,
  unique). The plaintext is returned once, in the join response, and never again.
* **Repeat join.** Joining an existing email returns `created:false` and no code,
  and never changes the stored hash (the insert is `ON CONFLICT DO NOTHING`).
* **Credentials.** One generic `401` for unknown email, wrong code or malformed
  code; `400` only for a malformed request. Joins, balance lookups, quotes and the
  checkout credential check are rate limited per client and per email.
* **Server-owned balances.** Browsers never send a balance or discount; checkout
  re-authenticates, re-reads the real balance, re-caps the request to multiples
  of 100, the balance and the $1 minimum, and stores the result on the order.
* **Atomic, idempotent accounting.** Neon's HTTP driver runs one statement per
  request, so each movement is a single data-modifying CTE: the ledger row and
  the balance change commit together or not at all. The unique index on
  `(order_reference, reason)` gives database-enforced per-order idempotency for
  `order`, `redeem` and `redeem_release`. Reservations lock the member row
  (`FOR UPDATE`) so concurrent checkouts re-check the committed balance.
  `CHECK (points_balance >= 0)` is the final backstop.
* **Earning.** `markOrderPaidWithPaymentEmail` calls the award on every
  mark-paid that returns a paid order. Points are `floor(paid_cents x earnBasis /
  10000)` at the tier held before the order, and lifetime spend rises by the
  amount paid. A club failure is logged and never fails marking paid.
* **Redemption policy (reserve / release).** Points are reserved (deducted,
  ledger reason `redeem`) when a PayID order is created, keyed by the order
  reference, and the order stores `club_points_redeemed` and
  `club_discount_cents`. PayPal orders do not redeem points. Reserved points stay
  held while the order is `awaiting_payment`. Cancelling an unpaid order (admin
  desk or `POST /api/admin/orders/[reference]/cancel`) sets it `cancelled` and
  releases the points (`redeem_release`). There is no automatic expiry in v1.
  If the order insert fails the points are released immediately. A cancelled
  order that held points cannot be marked paid (409 / "blocked" notice): use
  `POST /api/admin/club/members/[email]/adjust` if money really arrived.
* **Display.** The line reads `Club points −$X` at checkout, on `/order/[ref]`,
  in `/admin/orders` and in the customer and merchant emails. The value is
  frozen on the order (`club_discount_cents`).

## Failed awards: retry and reconciliation

1. Marking the order paid again (admin button or `POST /api/admin/orders/[ref]/paid`)
   retries the award; the database ignores a repeat.
2. `POST /api/admin/club/reconcile` (bearer `ADMIN_API_SECRET`, optional body
   `{"limit":100}`) finds and fixes: paid orders of members with no `order`
   ledger row, paid on or after both the member joining and `earningStartsAt`;
   cancelled orders whose points were never released; and reservations older than
   one hour whose order row was never written. It is idempotent, so running it
   twice is harmless, and it is safe to run on a schedule. It returns
   `{enabled, awardedOrders, releasedOrders, failures}`.
3. Failures are logged with the order reference only (no email or code).

## Setup and migration

1. Set `CLUB_CODE_SECRET` (32+ random characters, e.g. `openssl rand -hex 32`)
   in the hosting environment. Without it joining and credential checks return
   503 and the build migration fails if legacy plaintext codes exist.
2. `npm run build` runs `ensure-orders-table`, then `ensure-club-tables`, which
   (idempotently) applies `db/club.sql`, backfills `orders.club_discount_cents`
   for legacy redeemed orders at the old 5c per point, HMAC-hashes any legacy
   plaintext codes (6-character `RL-XXXXXX` codes still work) and erases the
   plaintext. With no `DATABASE_URL` the steps skip.
3. Review `db/club.sql` against production first. It adds CHECK constraints
   (normalised email, non-negative balances); existing rows violating them would
   fail the migration, so check before deploying.

Local verification of the SQL (not part of CI): run a throwaway Postgres, apply
`db/club.sql` and `db/orders.sql`, then drive `club-db.ts` through a `pg`-backed
`Sql` wrapper. This was done during development with 20 parallel connections:
five concurrent 100-point reservations on a 200-point balance yielded exactly two
successes; four concurrent awards for one order moved the balance once; three
concurrent releases returned the points once; ledger sums matched balances; and
reconcile recovered missed awards and releases. The unit tests exercise the same
logic against an in-memory emulation of each statement.

## Known limits (v1)

* Joining needs no email verification, by design. Anyone can register an email
  they do not own and receive its code; the real owner then sees "already in the
  club" and cannot reclaim it without admin help. A joined/not-joined difference
  also reveals membership. Consider email verification in v2.
* Rate limits are in process memory, so they are per server instance (as for the
  rest of the site) and per-email limits can be used to lock a victim out briefly.
  A shared store (e.g. Redis) would harden this.
* The earn tier is read just before the award statement; two simultaneous awards
  for one member can both use the earlier tier.
* Member codes are bearer secrets: anyone holding email plus code can spend points.

## Deployment checklist

- [ ] Business signs off earn rates, conversion and `earningStartsAt` (tier
      names and thresholds are done); they are entered in `CLUB_PROGRAM` with `approved: true`.
- [ ] `CLUB_CODE_SECRET` set in every environment (do not rotate casually).
- [ ] `ADMIN_API_SECRET` set (reconcile, adjust and cancel are bearer routes).
- [ ] Migration reviewed against production data; a database backup exists.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` pass.
- [ ] After deploy: join with a test email, confirm the code is shown once and a
      repeat join shows none, mark a test order paid, confirm points, redeem on a
      PayID test order, cancel an unpaid order and confirm the release.
- [ ] Schedule or document the reconcile call.
