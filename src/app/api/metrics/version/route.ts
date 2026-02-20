import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await supabase
    .from('daily_metrics')
    .select('collected_at')
    .order('collected_at', { ascending: false })
    .limit(1)
    .single();

  return Response.json({ v: data?.collected_at ?? null });
}
