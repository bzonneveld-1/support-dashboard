import { supabase } from '@/lib/db';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create table via Supabase SQL
  const { error } = await supabase.rpc('exec_sql', {
    query: `
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
        collected_at           TIMESTAMPTZ DEFAULT NOW(),
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(metric_date, time_slot)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(metric_date);
    `,
  });

  if (error) {
    // If RPC doesn't exist, instruct to run SQL manually
    return Response.json({
      error: 'Run SQL directly in Supabase SQL Editor',
      sql: 'See /sql/001_create_daily_metrics.sql',
      details: error.message,
    }, { status: 500 });
  }

  return Response.json({ success: true, message: 'Database initialized' });
}
