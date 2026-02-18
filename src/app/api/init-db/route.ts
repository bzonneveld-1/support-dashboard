import { initDb } from '@/lib/db';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDb();
  return Response.json({ success: true, message: 'Database initialized' });
}
