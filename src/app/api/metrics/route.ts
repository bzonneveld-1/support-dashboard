import { z } from 'zod';
import { supabase, getWeekBounds } from '@/lib/db';

const optionalMetric = z.union([z.number().int().min(0), z.null()]).optional();

const MetricsSchema = z.object({
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.enum(['08:00', '18:00', 'latest']),
  unassigned_tickets: optionalMetric,
  all_open_tickets: optionalMetric,
  whatsapp_all_open: optionalMetric,
  whatsapp_waiting_on_us: optionalMetric,
  waiting_on_us: optionalMetric,
  total_calls: optionalMetric,
  calls_answered: optionalMetric,
  calls_missed: optionalMetric,
  total_chatbot_chats: optionalMetric,
  total_emails: optionalMetric,
  total_wa_messages: optionalMetric,
  revenue_mtd: optionalMetric,
  revenue_daily: optionalMetric,
  subscriptions_active: optionalMetric,
  subscriptions_new: optionalMetric,
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

  const upsertData: Record<string, unknown> = {
    metric_date: body.metric_date,
    time_slot: body.time_slot,
    collected_at: new Date().toISOString(),
  };

  const optionalFields = [
    'unassigned_tickets', 'all_open_tickets', 'whatsapp_all_open',
    'whatsapp_waiting_on_us', 'waiting_on_us', 'total_calls', 'calls_answered', 'calls_missed',
    'total_chatbot_chats', 'total_emails', 'total_wa_messages',
    'revenue_mtd', 'revenue_daily', 'subscriptions_active', 'subscriptions_new',
  ] as const;

  for (const field of optionalFields) {
    if (body[field] !== undefined) {
      upsertData[field] = body[field]; // includes explicit null
    }
  }

  const { error } = await supabase
    .from('daily_metrics')
    .upsert(upsertData, { onConflict: 'metric_date,time_slot' });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weeksParam = searchParams.get('weeks');
  const week = searchParams.get('week') || 'current';

  let startDate: string;
  let endDate: string;

  try {
    if (weeksParam) {
      const numWeeks = Math.min(Math.max(parseInt(weeksParam) || 4, 1), 12);
      const currentBounds = getWeekBounds('current');
      endDate = currentBounds.endDate;
      const start = new Date(currentBounds.startDate + 'T12:00:00Z');
      start.setUTCDate(start.getUTCDate() - (numWeeks - 1) * 7);
      startDate = start.toISOString().split('T')[0];
    } else {
      const bounds = getWeekBounds(week);
      startDate = bounds.startDate;
      endDate = bounds.endDate;
    }
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('daily_metrics')
    .select('*')
    .gte('metric_date', startDate)
    .lt('metric_date', endDate)
    .order('metric_date')
    .order('time_slot');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    week: startDate,
    weekEnd: endDate,
    metrics: data,
  });
}
