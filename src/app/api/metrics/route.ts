import { sql } from '@vercel/postgres';
import { z } from 'zod';
import { getWeekBounds } from '@/lib/db';

const MetricsSchema = z.object({
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.enum(['08:00', '18:00']),
  unassigned_tickets: z.number().int().min(0),
  all_open_tickets: z.number().int().min(0),
  whatsapp_all_open: z.number().int().min(0),
  whatsapp_waiting_on_us: z.number().int().min(0),
  waiting_on_us: z.number().int().min(0),
  total_calls: z.number().int().min(0),
  total_chatbot_chats: z.number().int().min(0),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = MetricsSchema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Validation failed', details: err }, { status: 400 });
  }

  await sql`
    INSERT INTO daily_metrics (
      metric_date, time_slot,
      unassigned_tickets, all_open_tickets,
      whatsapp_all_open, whatsapp_waiting_on_us, waiting_on_us,
      total_calls, total_chatbot_chats
    ) VALUES (
      ${body.metric_date}, ${body.time_slot},
      ${body.unassigned_tickets}, ${body.all_open_tickets},
      ${body.whatsapp_all_open}, ${body.whatsapp_waiting_on_us},
      ${body.waiting_on_us}, ${body.total_calls}, ${body.total_chatbot_chats}
    )
    ON CONFLICT (metric_date, time_slot) DO UPDATE SET
      unassigned_tickets = EXCLUDED.unassigned_tickets,
      all_open_tickets = EXCLUDED.all_open_tickets,
      whatsapp_all_open = EXCLUDED.whatsapp_all_open,
      whatsapp_waiting_on_us = EXCLUDED.whatsapp_waiting_on_us,
      waiting_on_us = EXCLUDED.waiting_on_us,
      total_calls = EXCLUDED.total_calls,
      total_chatbot_chats = EXCLUDED.total_chatbot_chats,
      collected_at = NOW()
  `;

  return Response.json({ success: true });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week') || 'current';

  let bounds;
  try {
    bounds = getWeekBounds(week);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const { rows } = await sql`
    SELECT * FROM daily_metrics
    WHERE metric_date >= ${bounds.startDate}::date
      AND metric_date < ${bounds.endDate}::date
    ORDER BY metric_date, time_slot
  `;

  return Response.json({
    week: bounds.startDate,
    weekEnd: bounds.endDate,
    metrics: rows,
  });
}
