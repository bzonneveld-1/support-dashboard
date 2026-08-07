// Subscriptions Target Counter, reconciliatie.
//
// Pure functies, geen IO. De collector (n8n) levert verse feiten uit Medusa en
// de support-sheet, deze module bepaalt wie meetelt. Elke run is een volledige
// hertelling, dus annuleringen zakken vanzelf en dubbel draaien is onschadelijk.

export const LIVE_STATUSES = ['active', 'onboarding', 'on_hold', 'requires_action'];

export const DIRECT_SALES_CHANNEL_ID = 'sc_01KF3DQN5QAH44ACQKRBJ6N15K';

export type Source = 'direct_sales' | 'support';

export interface MedusaSub {
  id: string;
  display_id: number;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer_email: string | null;
}

export interface Claim {
  row: number;
  date?: string;
  agent?: string;
  email?: string;
  sub_number?: string;
  hubspot_url?: string;
  note?: string;
}

/** Opzoekresultaat voor een claim-nummer dat niet in het target-venster viel. */
export interface ClaimLookup {
  found: boolean;
  sub_id?: string;
  display_id?: number;
  status?: string;
  created_at?: string;
}

export interface SyncInput {
  medusa_ok: boolean;
  sheet_ok: boolean;
  /** True wanneer de paginatie over Medusa compleet doorliep zonder fout. */
  subs_complete?: boolean;
  subs: MedusaSub[];
  /** customer_id → datum van de vroegste Direct Sales order. */
  ds_customers: Record<string, string>;
  claims: Claim[];
  claim_lookups?: Record<string, ClaimLookup>;
}

export interface ExistingSub {
  sub_id: string;
  source: string | null;
  status: string;
  first_counted_at: string | null;
  canceled_detected_at: string | null;
  agent: string | null;
  hubspot_url: string | null;
  sheet_row: number | null;
}

export interface TargetSubRow {
  sub_id: string;
  display_id: number;
  source: Source | null;
  status: 'live' | 'canceled';
  medusa_status: string;
  sub_created_at: string;
  first_counted_at: string | null;
  canceled_detected_at: string | null;
  customer_id: string | null;
  customer_email: string | null;
  agent: string | null;
  hubspot_url: string | null;
  sheet_row: number | null;
  ds_first_order_at: string | null;
  updated_at: string;
}

export interface PendingRow {
  sheet_row: number;
  raw: Claim;
  reason: string;
  updated_at: string;
}

export interface RowStatus {
  row: number;
  text: string;
}

export interface ReconcileResult {
  rows: TargetSubRow[];
  pending: PendingRow[];
  rowStatuses: RowStatus[];
  warnings: string[];
  counts: { total: number; direct_sales: number; support: number; canceled: number };
}

export interface TargetConfig {
  start: string;
  end: string;
  goal: number;
}

// ── Normalisatie ───────────────────────────────────────────────────────

export function normEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** "#1310", " 1310 ", "1310" → 1310. Alles anders → null. */
export function normSubNumber(value: unknown): number | null {
  const raw = String(value ?? '').trim().replace(/^#/, '').replace(/\s+/g, '');
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Support mag ook de Medusa-id plakken in plaats van het nummer. */
export function normSubId(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return /^sub_[A-Za-z0-9]+$/.test(raw) ? raw : null;
}

export function isLive(medusaStatus: string): boolean {
  return LIVE_STATUSES.includes(medusaStatus);
}

function isBlankClaim(claim: Claim): boolean {
  return !String(claim.email ?? '').trim()
    && !String(claim.sub_number ?? '').trim()
    && !String(claim.agent ?? '').trim()
    && !String(claim.hubspot_url ?? '').trim();
}

/**
 * De datumkolom is vrije tekst. Ondersteunt dd-mm-jjjj, dd/mm/jjjj en
 * jjjj-mm-dd. Onleesbaar → null, dan valt de matching terug op nieuwste eerst.
 */
export function parseClaimDate(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);

  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);

  return null;
}

function dayStart(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.floor(t / 86_400_000) * 86_400_000;
}

function fmtDay(iso: string): string {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// ── Reconciliatie ──────────────────────────────────────────────────────

export function reconcile(
  input: SyncInput,
  existing: Map<string, ExistingSub>,
  config: TargetConfig,
  now: Date,
): ReconcileResult {
  const nowIso = now.toISOString();
  const warnings: string[] = [];
  const rowStatuses: RowStatus[] = [];
  const pending: PendingRow[] = [];

  const startMs = Date.parse(config.start);
  const endMs = Date.parse(config.end);

  // Onbekende Medusa-statussen niet stilzwijgend als live tellen.
  for (const s of input.subs) {
    if (!isLive(s.status) && s.status !== 'canceled') {
      warnings.push(`Unknown status "${s.status}" on #${s.display_id}, treated as not live`);
    }
  }

  const byId = new Map(input.subs.map(s => [s.id, s]));
  const byDisplayId = new Map(input.subs.map(s => [s.display_id, s]));

  const claimedSubId = new Map<string, number>();   // sub_id → sheet-rij die hem pakte
  const claimBySubId = new Map<string, Claim>();

  // Is de sheet onleesbaar, dan gelden de support-claims die al in de database
  // staan. Anders zou één Google-storing alle support-attributie wissen en de
  // teller laten kelderen.
  if (!input.sheet_ok) {
    for (const prev of existing.values()) {
      if (prev.source !== 'support') continue;
      claimedSubId.set(prev.sub_id, prev.sheet_row ?? 0);
      claimBySubId.set(prev.sub_id, {
        row: prev.sheet_row ?? 0,
        agent: prev.agent ?? undefined,
        hubspot_url: prev.hubspot_url ?? undefined,
      });
    }
    warnings.push('Sheet unreadable, reused the support claims already in the database');
  }

  const claims = (input.sheet_ok ? input.claims : []).filter(c => !isBlankClaim(c));
  const ordered = [...claims].sort((a, b) => a.row - b.row);

  // Ronde 1: claims met een expliciet nummer of Medusa-id.
  const unresolvedByNumber: Claim[] = [];
  // Rijen waarvan het ingevulde nummer nergens op sloeg. Die val je anders
  // stilzwijgend terug op het e-mailadres, en dan leert niemand dat hij een
  // ordernummer heeft geplakt in plaats van een abonnementsnummer.
  const badNumberByRow = new Map<number, string>();
  for (const claim of ordered) {
    const subId = normSubId(claim.sub_number);
    const num = normSubNumber(claim.sub_number);
    if (subId === null && num === null) {
      unresolvedByNumber.push(claim);
      continue;
    }

    const sub = subId !== null ? byId.get(subId) : byDisplayId.get(num!);
    if (!sub) {
      // Buiten het venster of onbekend. n8n heeft het los opgezocht.
      const lookup = input.claim_lookups?.[String(subId ?? num)];
      const label = subId ?? `#${num}`;
      if (lookup?.found && lookup.created_at && Date.parse(lookup.created_at) < startMs) {
        rowStatuses.push({ row: claim.row, text: `⚠️ ${label} started on ${fmtDay(lookup.created_at)}, before the start date, does not count` });
        pending.push({ sheet_row: claim.row, raw: claim, reason: 'before_start', updated_at: nowIso });
      } else if (lookup?.found) {
        rowStatuses.push({ row: claim.row, text: `⚠️ ${label} falls outside the target window, does not count` });
        pending.push({ sheet_row: claim.row, raw: claim, reason: 'outside_window', updated_at: nowIso });
      } else {
        // Nummer klopt niet. Als er een e-mailadres staat, alsnog via e-mail proberen.
        if (normEmail(claim.email)) {
          badNumberByRow.set(claim.row, label);
          unresolvedByNumber.push({ ...claim, sub_number: '' });
        } else {
          rowStatuses.push({ row: claim.row, text: `❌ ${label} does not exist in Medusa, check the number` });
          pending.push({ sheet_row: claim.row, raw: claim, reason: 'unknown_number', updated_at: nowIso });
        }
      }
      continue;
    }

    const taken = claimedSubId.get(sub.id);
    if (taken !== undefined) {
      rowStatuses.push({ row: claim.row, text: `⚠️ Duplicate, #${sub.display_id} is already on row ${taken}` });
      pending.push({ sheet_row: claim.row, raw: claim, reason: 'duplicate', updated_at: nowIso });
      continue;
    }
    claimedSubId.set(sub.id, claim.row);
    claimBySubId.set(sub.id, claim);
  }

  // Ronde 2: claims zonder (bruikbaar) nummer, koppelen op e-mailadres.
  const boundViaEmail = new Set<string>();
  const byEmail = new Map<string, MedusaSub[]>();
  for (const s of input.subs) {
    const e = normEmail(s.customer_email);
    if (!e) continue;
    const list = byEmail.get(e);
    if (list) list.push(s);
    else byEmail.set(e, [s]);
  }

  for (const claim of unresolvedByNumber) {
    const email = normEmail(claim.email);
    if (!email) {
      rowStatuses.push({ row: claim.row, text: '❌ No subscription number and no email address, cannot link' });
      pending.push({ sheet_row: claim.row, raw: claim, reason: 'no_identifier', updated_at: nowIso });
      continue;
    }
    // Eén klant kan meerdere abonnementen hebben, soms op dezelfde dag. Een
    // lopend abonnement gaat vóór een geannuleerd (anders slokt een mislukte
    // poging de claim op), daarna het abonnement dat het dichtst bij de
    // opgegeven datum ligt, en zonder bruikbare datum het nieuwste.
    const claimDay = parseClaimDate(claim.date);
    const candidates = (byEmail.get(email) ?? [])
      .filter(s => !claimedSubId.has(s.id))
      .sort((a, b) => {
        const liveDiff = Number(isLive(b.status)) - Number(isLive(a.status));
        if (liveDiff !== 0) return liveDiff;
        if (claimDay !== null) {
          // Op dagniveau vergelijken. De claimdatum heeft geen tijd, dus
          // anders wint altijd het vroegste abonnement van die dag.
          const da = Math.abs(dayStart(a.created_at) - claimDay);
          const db = Math.abs(dayStart(b.created_at) - claimDay);
          if (da !== db) return da - db;
        }
        return Date.parse(b.created_at) - Date.parse(a.created_at);
      });

    if (candidates.length === 0) {
      const bad = badNumberByRow.get(claim.row);
      rowStatuses.push({
        row: claim.row,
        text: '⏳ Waiting for activation, no subscription on this email address yet'
          + (bad ? `. Note, ${bad} is not a subscription number` : ''),
      });
      pending.push({ sheet_row: claim.row, raw: claim, reason: 'awaiting_activation', updated_at: nowIso });
      continue;
    }
    const sub = candidates[0];
    claimedSubId.set(sub.id, claim.row);
    claimBySubId.set(sub.id, { ...claim, sub_number: String(sub.display_id) });
    boundViaEmail.add(sub.id);
  }

  // ── Per subscription de bron bepalen en de rij opbouwen ──────────────
  const rows: TargetSubRow[] = [];
  const counts = { total: 0, direct_sales: 0, support: 0, canceled: 0 };

  for (const sub of input.subs) {
    const createdMs = Date.parse(sub.created_at);
    const inWindow = createdMs >= startMs && createdMs <= endMs;
    const live = isLive(sub.status);
    const claim = claimBySubId.get(sub.id);
    const dsOrderAt = sub.customer_id ? input.ds_customers[sub.customer_id] ?? null : null;

    let source: Source | null = null;
    if (inWindow) {
      if (claim) source = 'support';
      else if (dsOrderAt) source = 'direct_sales';
    }

    const prev = existing.get(sub.id);
    const counting = source !== null && live;

    let firstCountedAt = prev?.first_counted_at ?? null;
    if (counting && !firstCountedAt) firstCountedAt = nowIso;

    let canceledAt = prev?.canceled_detected_at ?? null;
    if (!live && source !== null && !canceledAt) canceledAt = nowIso;

    rows.push({
      sub_id: sub.id,
      display_id: sub.display_id,
      source,
      status: live ? 'live' : 'canceled',
      medusa_status: sub.status,
      sub_created_at: sub.created_at,
      first_counted_at: firstCountedAt,
      canceled_detected_at: canceledAt,
      customer_id: sub.customer_id,
      customer_email: sub.customer_email,
      agent: claim?.agent?.trim() || null,
      hubspot_url: claim?.hubspot_url?.trim() || null,
      sheet_row: claim?.row ?? null,
      ds_first_order_at: dsOrderAt,
      updated_at: nowIso,
    });

    if (counting) {
      counts.total += 1;
      if (source === 'direct_sales') counts.direct_sales += 1;
      else counts.support += 1;
    } else if (source !== null && !live) {
      counts.canceled += 1;
    }

    // Statusregel terug naar de sheet.
    if (claim && input.sheet_ok) {
      const label = `#${sub.display_id}`;
      const viaEmail = boundViaEmail.has(sub.id);
      if (!inWindow) {
        rowStatuses.push({ row: claim.row, text: `⚠️ ${label} falls outside the target window, does not count` });
      } else if (!live) {
        rowStatuses.push({ row: claim.row, text: `📉 ${label} was canceled${canceledAt ? ` on ${fmtDay(canceledAt)}` : ''}, no longer counts` });
      } else if (viaEmail) {
        const bad = badNumberByRow.get(claim.row);
        rowStatuses.push({
          row: claim.row,
          text: `✅ Linked by email, ${label}, counts`
            + (bad ? `. Note, ${bad} is not a subscription number` : ''),
        });
      } else {
        rowStatuses.push({ row: claim.row, text: `✅ Counts, ${label}, ${sub.status}` });
      }
    }
  }

  return { rows, pending, rowStatuses, warnings, counts };
}
