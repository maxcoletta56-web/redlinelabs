CREATE TABLE IF NOT EXISTS club_members (
  email TEXT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  member_code TEXT NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_spend_cents INTEGER NOT NULL DEFAULT 0,
  first_order_bonus_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
