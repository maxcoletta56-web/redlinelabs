CREATE TABLE IF NOT EXISTS whop_payments (
  payment_id TEXT PRIMARY KEY,
  order_reference TEXT NOT NULL,
  outcome TEXT NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
