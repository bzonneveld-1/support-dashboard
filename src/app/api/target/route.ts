import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SubRow {
  sub_id: string;
  display_id: number;
  source: 'direct_sales' | 'support';
  status: 'live' | 'canceled';
  sub_created_at: string;
  first_counted_at: string | null;
  canceled_detected_at: string | null;
  agent: string | null;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function GET() {
  const [{ data: configRows }, { data: subRows, error }, { data: pendingRows }] = await Promise.all([
    supabase.from('target_config').select('key, value'),
    supabase
      .from('target_subs')
      .select('sub_id, display_id, source, status, sub_created_at, first_counted_at, canceled_detected_at, agent')
      .not('source', 'is', null)
      .order('first_counted_at', { ascending: false }),
    supabase.from('target_claims_pending').select('reason'),
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const config = new Map((configRows ?? []).map(r => [r.key as string, r.value as string]));
  const goal = parseInt(config.get('target_goal') ?? '100', 10);
  const start = config.get('target_start') ?? '2026-08-06T22:00:00Z';
  const end = config.get('target_end') ?? '2026-12-31T22:59:59Z';
  const lastSyncAt = config.get('last_sync_at') ?? null;
  const refreshLabel = config.get('refresh_label') ?? 'every 5 min';

  const rows = (subRows ?? []) as SubRow[];
  const live = rows.filter(r => r.status === 'live');

  const counted = live.map(r => ({
    sub_id: r.sub_id,
    display_id: r.display_id,
    source: r.source,
    agent: r.agent,
    created_at: r.sub_created_at,
    counted_at: r.first_counted_at,
  }));

  // Nettovoortgang per dag. +1 op de aanmaakdatum van het abonnement (de echte
  // bedrijfsdatum), −1 op de dag waarop een annulering gezien werd.
  const delta = new Map<string, number>();
  for (const r of rows) {
    if (!r.first_counted_at) continue;
    const up = dayKey(r.sub_created_at);
    delta.set(up, (delta.get(up) ?? 0) + 1);
    if (r.status === 'canceled' && r.canceled_detected_at) {
      const down = dayKey(r.canceled_detected_at);
      delta.set(down, (delta.get(down) ?? 0) - 1);
    }
  }
  let running = 0;
  const series = [...delta.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({ date, total: (running += d) }));

  const now = new Date();
  const endMs = Date.parse(end);
  const startMs = Date.parse(start);
  const msPerDay = 86_400_000;
  const daysLeft = Math.max(0, Math.ceil((endMs - now.getTime()) / msPerDay));
  // Minstens een volle week, anders extrapoleert een halve week naar een
  // weektempo dat hoger ligt dan het totaal en dat leest als onzin. In week
  // één is het tempo dus gewoon wat er tot nu toe binnen is.
  const daysElapsed = Math.max(7, (now.getTime() - startMs) / msPerDay);

  const total = live.length;
  const remaining = Math.max(0, goal - total);
  const neededPerWeek = daysLeft > 0 ? (remaining / daysLeft) * 7 : 0;
  const actualPerWeek = (total / daysElapsed) * 7;

  return Response.json({
    goal,
    total,
    direct_sales: live.filter(r => r.source === 'direct_sales').length,
    support: live.filter(r => r.source === 'support').length,
    canceled: rows.filter(r => r.status === 'canceled').length,
    // Wachten op activatie is iets anders dan een rij die aandacht nodig heeft.
    // Op de TV wil je die twee niet op één hoop.
    awaiting_activation: (pendingRows ?? []).filter(r => r.reason === 'awaiting_activation').length,
    needs_attention: (pendingRows ?? []).filter(r => r.reason !== 'awaiting_activation').length,
    days_left: daysLeft,
    needed_per_week: Math.round(neededPerWeek * 10) / 10,
    actual_per_week: Math.round(actualPerWeek * 10) / 10,
    on_track: actualPerWeek >= neededPerWeek,
    last_sync_at: lastSyncAt,
    refresh_label: refreshLabel,
    counted,
    series,
  });
}
