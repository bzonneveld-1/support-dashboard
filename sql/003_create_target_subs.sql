-- Subscriptions Target Counter: 100 nieuwe subs uit Direct Sales + Support
-- tussen 2026-08-07 en 2026-12-31. Zie subs-target-counter-plan.md

-- Alle subscriptions die na target_start zijn aangemaakt, ook de niet-tellende
-- (source NULL = webshop/in-app zonder support-claim). Zo is customer_email
-- eenmalig opgezocht en gecachet, en blijft zichtbaar hoeveel niet-target-subs
-- erbij kwamen.
CREATE TABLE IF NOT EXISTS target_subs (
  sub_id               TEXT PRIMARY KEY,
  display_id           INTEGER NOT NULL,
  source               TEXT CHECK (source IN ('direct_sales', 'support')),
  status               TEXT NOT NULL CHECK (status IN ('live', 'canceled')),
  medusa_status        TEXT NOT NULL,
  sub_created_at       TIMESTAMPTZ NOT NULL,
  first_counted_at     TIMESTAMPTZ,
  canceled_detected_at TIMESTAMPTZ,
  customer_id          TEXT,
  customer_email       TEXT,
  agent                TEXT,
  hubspot_url          TEXT,
  sheet_row            INTEGER,
  ds_first_order_at    TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_subs_counting
  ON target_subs(source, status) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_target_subs_created
  ON target_subs(sub_created_at);

-- Sheet-rijen die (nog) niet aan een subscription gekoppeld zijn.
CREATE TABLE IF NOT EXISTS target_claims_pending (
  sheet_row  INTEGER PRIMARY KEY,
  raw        JSONB NOT NULL,
  reason     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Config, aanpasbaar zonder deploy. Eigen tabel en niet kv_store: die heeft in
-- productie een verplichte owner-kolom die sql/002 niet kent.
CREATE TABLE IF NOT EXISTS target_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO target_config (key, value) VALUES
  ('target_goal',  '100'),
  ('target_start', '2026-08-06T22:00:00Z'),
  ('target_end',   '2026-12-31T22:59:59Z')
ON CONFLICT (key) DO NOTHING;
