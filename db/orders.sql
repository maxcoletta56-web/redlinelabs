CREATE TABLE IF NOT EXISTS orders (
  reference TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  currency TEXT NOT NULL DEFAULT 'aud',
  subtotal_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  promo_code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  items JSONB NOT NULL,
  shipping JSONB,
  club_email TEXT,
  club_points_redeemed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  volume_discount_cents INTEGER NOT NULL DEFAULT 0,
  whop_payment_id TEXT
);
