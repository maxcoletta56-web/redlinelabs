CREATE TABLE IF NOT EXISTS club_members (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  member_code TEXT,
  member_code_hash TEXT,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_spend_cents INTEGER NOT NULL DEFAULT 0,
  first_order_bonus_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS member_code_hash TEXT;

ALTER TABLE club_members ALTER COLUMN member_code DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS club_members_member_code_hash
  ON club_members (member_code_hash) WHERE member_code_hash IS NOT NULL;

ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_email_normalized;

ALTER TABLE club_members ADD CONSTRAINT club_members_email_normalized
  CHECK (email <> '' AND email = lower(btrim(email)));

ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_balances_not_negative;

ALTER TABLE club_members ADD CONSTRAINT club_members_balances_not_negative
  CHECK (points_balance >= 0 AND lifetime_spend_cents >= 0);

CREATE TABLE IF NOT EXISTS club_points_ledger (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL REFERENCES club_members(email) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_reference TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS club_points_ledger_order_reason
  ON club_points_ledger (order_reference, reason) WHERE order_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS club_points_ledger_email
  ON club_points_ledger (email, id DESC);
