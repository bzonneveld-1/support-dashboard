import { getInboxMetrics } from '@/lib/hubspot-session';

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const metrics = await getInboxMetrics();
    return Response.json({ success: true, ...metrics });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[hubspot-inbox]', msg);

    if (msg.includes('NEEDS_LOGIN_LINK')) {
      return Response.json({ error: 'NEEDS_LOGIN_LINK', details: msg }, { status: 503 });
    }
    return Response.json({ error: 'HubSpot request failed', details: msg }, { status: 502 });
  }
}
