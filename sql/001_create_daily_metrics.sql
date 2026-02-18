CREATE TABLE IF NOT EXISTS daily_metrics (
  id                     SERIAL PRIMARY KEY,
  metric_date            DATE NOT NULL,
  time_slot              VARCHAR(5) NOT NULL,

  -- Snapshot metrics (retroactief gereconstrueerd)
  unassigned_tickets     INTEGER,
  all_open_tickets       INTEGER,
  whatsapp_all_open      INTEGER,
  whatsapp_waiting_on_us INTEGER,
  waiting_on_us          INTEGER,

  -- Dagtotalen
  total_calls            INTEGER,
  total_chatbot_chats    INTEGER,

  -- Metadata
  collected_at           TIMESTAMP DEFAULT NOW(),
  created_at             TIMESTAMP DEFAULT NOW(),

  UNIQUE(metric_date, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(metric_date);
