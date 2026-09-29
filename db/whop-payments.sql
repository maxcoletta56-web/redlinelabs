CREATE TABLE IF NOT EXISTS whop_payments (
  payment_id TEXT PRIMARY KEY,
  reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
