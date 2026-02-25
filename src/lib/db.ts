import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  calls_answered: number | null;
  calls_missed: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
  revenue_mtd: number | null;
  revenue_daily: number | null;
  subscriptions_active: number | null;
  subscriptions_new: number | null;
  collected_at: string;
  created_at: string;
}

// Format a local Date as YYYY-MM-DD without timezone conversion
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function getWeekBounds(week: string): { startDate: string; endDate: string } {
  if (week === 'current') {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = start
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);

    return {
      startDate: fmtDate(monday),
      endDate: fmtDate(nextMonday),
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
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(year, 0, 4 - jan4Day + 1 + (weekNum - 1) * 7);
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);

  return {
    startDate: fmtDate(monday),
    endDate: fmtDate(nextMonday),
  };
}
