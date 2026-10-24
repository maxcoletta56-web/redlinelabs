CREATE TABLE IF NOT EXISTS distribution_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  abn TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS distribution_quotes (
  reference TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES distribution_accounts(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'quoted', 'accepted', 'declined')),
  lines JSONB NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS distribution_quotes_account_created_idx
  ON distribution_quotes (account_id, created_at DESC);
