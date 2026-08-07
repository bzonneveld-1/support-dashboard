import { z } from 'zod';
import { supabase } from '@/lib/db';
import { reconcile, type ExistingSub, type SyncInput, type TargetConfig } from '@/lib/target';

export const dynamic = 'force-dynamic';

const SubSchema = z.object({
  id: z.string(),
  display_id: z.number().int(),
  status: z.string(),
  created_at: z.string(),
  customer_id: z.string().nullable().optional().default(null),
  customer_email: z.string().nullable().optional().default(null),
});

const ClaimSchema = z.object({
  row: z.number().int().positive(),
  date: z.string().optional(),
  agent: z.string().optional(),
  email: z.string().optional(),
  sub_number: z.string().optional(),
  hubspot_url: z.string().optional(),
  note: z.string().optional(),
});

const UpsertSchema = z.object({
  action: z.literal('upsert'),
  medusa_ok: z.boolean(),
  sheet_ok: z.boolean(),
  subs_complete: z.boolean().optional(),
  subs: z.array(SubSchema).default([]),
  ds_customers: z.record(z.string()).default({}),
  claims: z.array(ClaimSchema).default([]),
  claim_lookups: z.record(z.object({
    found: z.boolean(),
    sub_id: z.string().optional(),
    display_id: z.number().int().optional(),
    status: z.string().optional(),
    created_at: z.string().optional(),
  })).optional(),
});

const ReadKnownSchema = z.object({ action: z.literal('read_known') });

const BodySchema = z.union([ReadKnownSchema, UpsertSchema]);

async function loadConfig(): Promise<TargetConfig> {
  const { data } = await supabase.from('target_config').select('key, value');
  const map = new Map((data ?? []).map(r => [r.key as string, r.value as string]));
  return {
    goal: parseInt(map.get('target_goal') ?? '100', 10),
    start: map.get('target_start') ?? '2026-08-06T22:00:00Z',
    end: map.get('target_end') ?? '2026-12-31T22:59:59Z',
  };
}

export async function POST(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return Response.json({ error: 'Validation failed', details: err }, { status: 400 });
  }

  const config = await loadConfig();

  // De collector vraagt op welke subs we al kennen, zodat hij alleen voor
  // nieuwe subs een customer-lookup hoeft te doen.
  if (body.action === 'read_known') {
    const { data, error } = await supabase
      .from('target_subs')
      .select('sub_id, customer_email');
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ config, known: data ?? [] });
  }

  // Fail-safe. Zonder verse Medusa-data niets wegschrijven, anders lijkt alles
  // verdwenen en klapt de teller naar nul.
  if (!body.medusa_ok) {
    return Response.json({ ok: false, skipped: 'medusa_unavailable' }, { status: 200 });
  }

  const { data: existingRows, error: readErr } = await supabase
    .from('target_subs')
    .select('sub_id, source, status, first_counted_at, canceled_detected_at, agent, hubspot_url, sheet_row');
  if (readErr) return Response.json({ error: readErr.message }, { status: 500 });

  const existing = new Map<string, ExistingSub>(
    (existingRows ?? []).map(r => [r.sub_id as string, r as ExistingSub]),
  );

  const input: SyncInput = body;
  const result = reconcile(input, existing, config, new Date());

  if (result.rows.length > 0) {
    const { error } = await supabase
      .from('target_subs')
      .upsert(result.rows, { onConflict: 'sub_id' });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // Subs die uit Medusa verdwenen zijn opruimen, maar alleen wanneer de
  // collector meldt dat hij compleet doorgepagineerd is. Een halve fetch mag
  // nooit geldige rijen wissen.
  let pruned = 0;
  if (body.subs_complete === true) {
    const seen = new Set(result.rows.map(r => r.sub_id));
    const gone = [...existing.keys()].filter(id => !seen.has(id));
    if (gone.length > 0) {
      await supabase.from('target_subs').delete().in('sub_id', gone);
      pruned = gone.length;
    }
  }

  if (body.sheet_ok) {
    await supabase.from('target_claims_pending').delete().neq('sheet_row', -1);
    if (result.pending.length > 0) {
      await supabase.from('target_claims_pending').insert(result.pending);
    }
  }

  return Response.json({
    ok: true,
    counts: result.counts,
    goal: config.goal,
    row_statuses: result.rowStatuses,
    pending: result.pending.length,
    pruned,
    warnings: result.warnings,
    subs_seen: result.rows.length,
  });
}
