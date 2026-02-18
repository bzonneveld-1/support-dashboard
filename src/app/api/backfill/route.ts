import { z } from 'zod';

const BackfillSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.enum(['08:00', '18:00']),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = BackfillSchema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Validation failed', details: err }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_BACKFILL_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json({ error: 'N8N_BACKFILL_WEBHOOK_URL not configured' }, { status: 500 });
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_date: body.date,
      target_time: body.time_slot,
    }),
  });

  return Response.json({ triggered: true, date: body.date, time_slot: body.time_slot });
}
