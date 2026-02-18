import { z } from 'zod';
import { supabase, getWeekBounds } from '@/lib/db';

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

  const { error } = await supabase
    .from('daily_metrics')
    .upsert(
      {
        metric_date: body.metric_date,
        time_slot: body.time_slot,
        unassigned_tickets: body.unassigned_tickets,
        all_open_tickets: body.all_open_tickets,
        whatsapp_all_open: body.whatsapp_all_open,
        whatsapp_waiting_on_us: body.whatsapp_waiting_on_us,
        waiting_on_us: body.waiting_on_us,
        total_calls: body.total_calls,
        total_chatbot_chats: body.total_chatbot_chats,
        collected_at: new Date().toISOString(),
      },
      { onConflict: 'metric_date,time_slot' }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

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

  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .gte('metric_date', bounds.startDate)
    .lt('metric_date', bounds.endDate)
    .order('metric_date')
    .order('time_slot');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    week: bounds.startDate,
    weekEnd: bounds.endDate,
    metrics: data,
  });
}
