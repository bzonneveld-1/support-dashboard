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
  const jan4Day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Day + 1 + (weekNum - 1) * 7);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  return {
    startDate: monday.toISOString().split('T')[0],
    endDate: sunday.toISOString().split('T')[0],
  };
}
