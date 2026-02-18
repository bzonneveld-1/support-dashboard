import { sql } from '@vercel/postgres';

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS daily_metrics (
      id                     SERIAL PRIMARY KEY,
      metric_date            DATE NOT NULL,
      time_slot              VARCHAR(5) NOT NULL,
      unassigned_tickets     INTEGER,
      all_open_tickets       INTEGER,
      whatsapp_all_open      INTEGER,
      whatsapp_waiting_on_us INTEGER,
      waiting_on_us          INTEGER,
      total_calls            INTEGER,
      total_chatbot_chats    INTEGER,
      collected_at           TIMESTAMP DEFAULT NOW(),
      created_at             TIMESTAMP DEFAULT NOW(),
      UNIQUE(metric_date, time_slot)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(metric_date)`;
}

export interface MetricsRow {
  id: number;
  metric_date: string;
  time_slot: string;
  unassigned_tickets: number | null;
  all_open_tickets: number | null;
  whatsapp_all_open: number | null;
  whatsapp_waiting_on_us: number | null;
  waiting_on_us: number | null;
  total_calls: number | null;
  total_chatbot_chats: number | null;
  collected_at: string;
  created_at: string;
}

export function getWeekBounds(week: string): { startDate: string; endDate: string } {
  if (week === 'current') {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = start
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
    };
  }

  // Parse ISO week: "2026-W08"
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid week format: ${week}. Use "current" or "YYYY-WNN"`);
  }

  const year = parseInt(match[1]);
  const weekNum = parseInt(match[2]);

  // ISO 8601: Week 1 contains Jan 4th
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // Convert Sunday=0 to 7
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (weekNum - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  return {
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
}
