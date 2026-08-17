// Subscriptions Target Counter, reconciliatie.
//
// Pure functies, geen IO. De collector (n8n) levert verse feiten uit Medusa en
// de support-sheet, deze module bepaalt wie meetelt. Elke run is een volledige
// hertelling, dus annuleringen zakken vanzelf en dubbel draaien is onschadelijk.

export const LIVE_STATUSES = ['active', 'onboarding', 'on_hold'];

/**
 * Statussen die we kennen maar die niet vanzelf meetellen, zodat ze geen
 * waarschuwing geven.
 *
 * `requires_action` betekent in Bold een stornering, zie de dunning-spec. Dat
 * heeft twee smaken, en `billed_count` uit Medusa zegt welke.
 *
 * - Heeft het abonnement al gefactureerd, dan is het een betalende klant met
 *   een teruggeboekte incasso. Dat blijft een gewonnen abonnement, dunning
 *   haalt hem er meestal weer bij.
 * - Heeft het nog nooit gefactureerd, dan is de eerste incasso nooit
 *   goedgekomen. Zo wordt elke verkoop via een draft order geboren, dus die
 *   telt binnen de machtigingstermijn wel mee en daarna niet meer.
 *
 * Zie de telregel in reconcile.
 */
export const KNOWN_STATUSES = ['canceled', 'requires_action'];

/**
 * Hoe lang een abonnement zonder één geslaagde incasso mag meetellen. Direct
 * Sales sluit een deal en de klant moet de incasso nog goedkeuren, dus de +1
 * landt op de verkoopdag. Komt de machtiging binnen deze termijn niet rond,
 * dan valt hij er weer uit, zodat mandaten die nooit goedkomen de 100 niet
 * opblazen. Er hangen er in Medusa een paar sinds april 2025.
 */
export const MANDATE_GRACE_DAYS = 30;

export const DIRECT_SALES_CHANNEL_ID = 'sc_01KF3DQN5QAH44ACQKRBJ6N15K';

export type Source = 'direct_sales' | 'support';

export interface MedusaSub {
  id: string;
  display_id: number;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer_email: string | null;
  /**
   * Aantal facturatie-orders van het abonnement zelf, dus niet de order waaruit
   * het ontstond. Alleen opgehaald voor abonnementen op `requires_action`, want
   * daar hangt de telregel ervan af. Onbekend telt als nooit gefactureerd.
   */
  billed_count?: number;
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

/** Abonnementen op een e-mailadres die buiten het target-venster vallen. */
export interface EmailLookup {
  display_id: number;
  status: string;
  created_at: string;
}

export interface SyncInput {
  medusa_ok: boolean;
  sheet_ok: boolean;
  /** True wanneer de paginatie over Medusa compleet doorliep zonder fout. */
  subs_complete?: boolean;
  subs: MedusaSub[];
  /** customer_id → datum van de vroegste Direct Sales order. */
  ds_customers: Record<string, string>;
  /**
   * E-mailadres → datum van de vroegste Direct Sales order. Vangnet, want
   * Medusa heeft soms twee klantrecords op hetzelfde adres en dan hangt het
   * abonnement aan het record zonder order. Gemeten op robert@cs-co.nl.
   */
  ds_emails?: Record<string, string>;
  claims: Claim[];
  claim_lookups?: Record<string, ClaimLookup>;
  /** e-mailadres → abonnementen erbuiten, om "bestaat niet" te onderscheiden
   *  van "bestaat wel maar viel buiten de periode". */
  email_lookups?: Record<string, EmailLookup[]>;
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
    if (!isLive(s.status) && !KNOWN_STATUSES.includes(s.status)) {
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
      const note = bad ? `. Note, ${bad} is not a subscription number` : '';

      // Bestaat er wél een abonnement op dit adres, maar buiten de periode?
      // Dat is iets heel anders dan "nog niet geactiveerd", en zonder dat
      // onderscheid blijft iemand wachten op iets dat er al is.
      const outside = (input.email_lookups?.[email] ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      if (outside.length > 0) {
        const o = outside[0];
        const before = Date.parse(o.created_at) < startMs;
        rowStatuses.push({
          row: claim.row,
          text: `⚠️ #${o.display_id} exists on this email but started on ${fmtDay(o.created_at)}, `
            + `${before ? 'before the start date' : 'outside the target window'}, so it does not count${note}`,
        });
        pending.push({ sheet_row: claim.row, raw: claim, reason: 'before_start', updated_at: nowIso });
        continue;
      }

      rowStatuses.push({
        row: claim.row,
        text: '⏳ Waiting for activation, no subscription on this email address yet' + note,
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
    const prevRow = existing.get(sub.id);

    // Alleen een echte annulering haalt een abonnement direct uit de telling.
    // Bij een stornering (requires_action) beslist de facturatiehistorie. Heeft
    // het al gefactureerd, dan is het een betalende klant met een teruggeboekte
    // incasso en blijft het een gewonnen abonnement. Heeft het nog nooit
    // gefactureerd, dan telt het alleen zolang de machtigingstermijn loopt.
    const canceled = sub.status === 'canceled';
    const everCounted = prevRow?.first_counted_at != null;
    const storno = sub.status === 'requires_action';
    const everBilled = (sub.billed_count ?? 0) > 0;
    const withinGrace = now.getTime() - createdMs <= MANDATE_GRACE_DAYS * 86_400_000;

    let live: boolean;
    if (canceled) live = false;
    else if (isLive(sub.status)) live = true;
    else if (storno) live = everBilled || withinGrace;
    else live = everCounted;   // status die we niet kennen, alleen als hij al meetelde

    const claim = claimBySubId.get(sub.id);
    const dsOrderAt = (sub.customer_id ? input.ds_customers[sub.customer_id] : null)
      ?? (sub.customer_email ? input.ds_emails?.[normEmail(sub.customer_email)] : null)
      ?? null;

    let source: Source | null = null;
    if (inWindow) {
      if (claim) source = 'support';
      else if (dsOrderAt) source = 'direct_sales';
    }

    const counting = source !== null && live;

    let firstCountedAt = prevRow?.first_counted_at ?? null;
    if (counting && !firstCountedAt) firstCountedAt = nowIso;

    // Alleen een abonnement dat écht meetelde kan daarna wegvallen. Een
    // abonnement dat nooit liep is niet geannuleerd, het is er nooit gekomen.
    let canceledAt = prevRow?.canceled_detected_at ?? null;
    if (!live && everCounted && !canceledAt) canceledAt = nowIso;

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
    } else if (source !== null && !live && everCounted) {
      counts.canceled += 1;
    }

    // Statusregel terug naar de sheet.
    if (claim && input.sheet_ok) {
      const label = `#${sub.display_id}`;
      const viaEmail = boundViaEmail.has(sub.id);
      if (!inWindow) {
        rowStatuses.push({ row: claim.row, text: `⚠️ ${label} falls outside the target window, does not count` });
      } else if (!live && storno && !everBilled) {
        rowStatuses.push({ row: claim.row, text: `📉 ${label} never got a direct debit through in ${MANDATE_GRACE_DAYS} days, no longer counts` });
      } else if (!live) {
        rowStatuses.push({ row: claim.row, text: `📉 ${label} was canceled${canceledAt ? ` on ${fmtDay(canceledAt)}` : ''}, no longer counts` });
      } else if (viaEmail) {
        const bad = badNumberByRow.get(claim.row);
        rowStatuses.push({
          row: claim.row,
          text: `✅ Linked by email, ${label}, counts`
            + (bad ? `. Note, ${bad} is not a subscription number` : ''),
        });
      } else if (storno) {
        rowStatuses.push({ row: claim.row, text: `✅ Counts, ${label}, waiting for the direct debit` });
      } else {
        rowStatuses.push({ row: claim.row, text: `✅ Counts, ${label}, ${sub.status}` });
      }
    }
  }

  return { rows, pending, rowStatuses, warnings, counts };
}
