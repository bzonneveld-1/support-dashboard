/**
 * Randgevallen van de target-reconciliatie. Draaien met:
 *   npx tsx tests/target-reconcile.ts
 */
import { reconcile, normSubNumber, parseClaimDate, type ExistingSub, type MedusaSub, type SyncInput } from '../src/lib/target';

const CONFIG = { start: '2026-08-06T22:00:00Z', end: '2026-12-31T22:59:59Z', goal: 100 };
const NOW = new Date('2026-09-01T10:00:00Z');

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ''); }
}

function sub(over: Partial<MedusaSub> & { id: string; display_id: number }): MedusaSub {
  return {
    status: 'active',
    created_at: '2026-08-20T10:00:00Z',
    customer_id: `cus_${over.display_id}`,
    customer_email: `k${over.display_id}@example.com`,
    ...over,
  };
}

function input(over: Partial<SyncInput> = {}): SyncInput {
  return { medusa_ok: true, sheet_ok: true, subs: [], ds_customers: {}, claims: [], ...over };
}

const noExisting = () => new Map<string, ExistingSub>();

// ── Normalisatie ───────────────────────────────────────────────────────
console.log('\nnormSubNumber');
check('kaal nummer', normSubNumber('1310') === 1310);
check('met hekje', normSubNumber('#1310') === 1310);
check('met spaties', normSubNumber('  #1310 ') === 1310);
check('leeg', normSubNumber('') === null);
check('tekst', normSubNumber('nog niet bekend') === null);
check('nul', normSubNumber('0') === null);

// ── Attributie ─────────────────────────────────────────────────────────
console.log('\nattributie');
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1 })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
  }), noExisting(), CONFIG, NOW);
  check('DS-klant telt als direct_sales', r.counts.direct_sales === 1 && r.counts.total === 1, r.counts);
  check('ds_first_order_at vastgelegd', r.rows[0].ds_first_order_at === '2026-06-02T00:00:00Z');
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1 })],
  }), noExisting(), CONFIG, NOW);
  check('webshop-sub zonder claim telt niet', r.counts.total === 0 && r.rows[0].source === null, r.counts);
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1 })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
    claims: [{ row: 2, agent: 'Nicolette', email: 'k1@example.com', sub_number: '1' }],
  }), noExisting(), CONFIG, NOW);
  check('support wint van direct sales', r.counts.support === 1 && r.counts.direct_sales === 0, r.counts);
  check('geen dubbeltelling', r.counts.total === 1, r.counts);
  check('agent overgenomen', r.rows[0].agent === 'Nicolette');
}

// ── Koppelen op e-mail ─────────────────────────────────────────────────
console.log('\nkoppelen op e-mail');
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 7, customer_email: 'Klant@Example.COM' })],
    claims: [{ row: 2, agent: 'Davy', email: '  klant@example.com ', sub_number: '' }],
  }), noExisting(), CONFIG, NOW);
  check('hoofdletters en spaties genegeerd', r.counts.support === 1, r.counts);
  check('status meldt e-mailkoppeling', /Linked by email/.test(r.rowStatuses[0]?.text ?? ''), r.rowStatuses);
}
{
  const r = reconcile(input({
    claims: [{ row: 2, agent: 'Davy', email: 'nog.niet@example.com', sub_number: '' }],
  }), noExisting(), CONFIG, NOW);
  check('nog geen sub, dus wachtend', r.pending[0]?.reason === 'awaiting_activation', r.pending);
  check('status wacht op activatie', /Waiting for activation/.test(r.rowStatuses[0]?.text ?? ''), r.rowStatuses);
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 7, customer_email: 'k@example.com' })],
    claims: [{ row: 2, agent: 'Davy', email: 'k@example.com', sub_number: '9999' }],
  }), noExisting(), CONFIG, NOW);
  check('fout nummer valt terug op e-mail', r.counts.support === 1, r.counts);
}
{
  const r = reconcile(input({
    claims: [{ row: 2, agent: 'Davy', sub_number: '9999' }],
  }), noExisting(), CONFIG, NOW);
  check('fout nummer zonder e-mail geeft fout', /does not exist in Medusa/.test(r.rowStatuses[0]?.text ?? ''), r.rowStatuses);
}
{
  // Iemand plakt een ordernummer. De terugval op e-mail mag dat niet verzwijgen.
  const r = reconcile(input({
    claims: [{ row: 2, agent: 'Bas', email: 'nog.niet@example.nl', sub_number: '110885' }],
  }), noExisting(), CONFIG, NOW);
  const t = r.rowStatuses[0]?.text ?? '';
  check('wacht op activatie én meldt het foute nummer',
    /Waiting for activation/.test(t) && /#110885 is not a subscription number/.test(t), t);
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 7, customer_email: 'k@x.nl' })],
    claims: [{ row: 2, agent: 'Bas', email: 'k@x.nl', sub_number: '110885' }],
  }), noExisting(), CONFIG, NOW);
  const t = r.rowStatuses[0]?.text ?? '';
  check('koppelt op e-mail én meldt het foute nummer',
    /Linked by email/.test(t) && /#110885 is not a subscription number/.test(t), t);
}

// ── Venster ────────────────────────────────────────────────────────────
console.log('\nvenster');
{
  const r = reconcile(input({
    claims: [{ row: 2, agent: 'Davy', sub_number: '1290' }],
    claim_lookups: { '1290': { found: true, created_at: '2026-05-01T00:00:00Z', status: 'active' } },
  }), noExisting(), CONFIG, NOW);
  check('oude sub telt niet mee', /before the start date/.test(r.rowStatuses[0]?.text ?? ''), r.rowStatuses);
  check('oude sub staat als pending', r.pending[0]?.reason === 'before_start', r.pending);
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1, created_at: '2027-01-05T00:00:00Z' })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
  }), noExisting(), CONFIG, NOW);
  check('sub na 31 december telt niet', r.counts.total === 0 && r.rows[0].source === null, r.counts);
}

// ── Annuleren en heractiveren ──────────────────────────────────────────
console.log('\nannuleren');
{
  const existing = new Map<string, ExistingSub>([['sub_a', {
    sub_id: 'sub_a', source: 'direct_sales', status: 'live',
    first_counted_at: '2026-08-20T10:00:00Z', canceled_detected_at: null,
    agent: null, hubspot_url: null, sheet_row: null,
  }]]);
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1, status: 'canceled' })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
  }), existing, CONFIG, NOW);
  check('geannuleerd telt niet meer', r.counts.total === 0, r.counts);
  check('geteld als canceled', r.counts.canceled === 1, r.counts);
  check('annuleerdatum gezet', r.rows[0].canceled_detected_at === NOW.toISOString());
  check('first_counted_at behouden', r.rows[0].first_counted_at === '2026-08-20T10:00:00Z');
}
{
  const existing = new Map<string, ExistingSub>([['sub_a', {
    sub_id: 'sub_a', source: 'direct_sales', status: 'canceled',
    first_counted_at: '2026-08-20T10:00:00Z', canceled_detected_at: '2026-08-25T10:00:00Z',
    agent: null, hubspot_url: null, sheet_row: null,
  }]]);
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1, status: 'active' })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
  }), existing, CONFIG, NOW);
  check('heractivatie telt weer mee', r.counts.total === 1, r.counts);
  check('oorspronkelijke telldatum blijft', r.rows[0].first_counted_at === '2026-08-20T10:00:00Z');
}
{
  // requires_action betekent hier een mandaat dat nooit rond kwam, die blijven
  // maanden hangen, dus dat is geen gewonnen abonnement.
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1, status: 'requires_action' })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
  }), noExisting(), CONFIG, NOW);
  check('requires_action telt niet mee', r.counts.total === 0, r.counts);
  check('requires_action geeft geen waarschuwing', r.warnings.length === 0, r.warnings);
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 1, status: 'expired_nieuw' })],
    ds_customers: { cus_1: '2026-06-02T00:00:00Z' },
  }), noExisting(), CONFIG, NOW);
  check('onbekende status telt niet mee', r.counts.total === 0, r.counts);
  check('onbekende status geeft waarschuwing', r.warnings.length === 1, r.warnings);
}

// ── Dubbele rijen ──────────────────────────────────────────────────────
console.log('\ndubbele rijen');
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 5 })],
    claims: [
      { row: 2, agent: 'Davy', email: 'k5@example.com', sub_number: '5' },
      { row: 9, agent: 'Ysbrand', email: 'k5@example.com', sub_number: '5' },
    ],
  }), noExisting(), CONFIG, NOW);
  check('telt maar één keer', r.counts.total === 1, r.counts);
  check('eerste rij wint', r.rows[0].sheet_row === 2, r.rows[0]);
  check('tweede rij gemarkeerd als dubbel', r.rowStatuses.some(s => s.row === 9 && /Duplicate/.test(s.text)), r.rowStatuses);
}
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 5 }), sub({ id: 'sub_b', display_id: 6, customer_email: 'k5@example.com' })],
    claims: [
      { row: 2, agent: 'Davy', email: 'k5@example.com', sub_number: '' },
      { row: 3, agent: 'Ysbrand', email: 'k5@example.com', sub_number: '' },
    ],
  }), noExisting(), CONFIG, NOW);
  check('twee subs op één e-mail, elk één rij', r.counts.support === 2, r.counts);
}

// ── Meerdere subs per klant ────────────────────────────────────────────
console.log('\nmeerdere subs per klant');
check('datum dd-mm-jjjj', parseClaimDate('06-08-2026') === Date.UTC(2026, 7, 6));
check('datum dd/mm/jjjj', parseClaimDate('6/8/2026') === Date.UTC(2026, 7, 6));
check('datum jjjj-mm-dd', parseClaimDate('2026-08-06') === Date.UTC(2026, 7, 6));
check('datum onleesbaar', parseClaimDate('gisteren') === null);
{
  // Precies het echte geval: drie abonnementen op één e-mailadres, één dag.
  const r = reconcile(input({
    subs: [
      sub({ id: 'sub_1303', display_id: 1303, status: 'onboarding', created_at: '2026-08-06T07:52:38Z', customer_email: 'k@x.nl' }),
      sub({ id: 'sub_1304', display_id: 1304, status: 'canceled', created_at: '2026-08-06T08:00:15Z', customer_email: 'k@x.nl' }),
      sub({ id: 'sub_1305', display_id: 1305, status: 'active', created_at: '2026-08-06T08:04:35Z', customer_email: 'k@x.nl' }),
    ],
    claims: [{ row: 2, date: '06-08-2026', agent: 'Davy', email: 'k@x.nl', sub_number: '' }],
  }), noExisting(), CONFIG, NOW);
  const claimed = r.rows.find(x => x.sheet_row === 2);
  check('pakt het nieuwste lopende abonnement', claimed?.display_id === 1305, claimed?.display_id);
  check('geannuleerde slokt de claim niet op', r.rows.find(x => x.display_id === 1304)?.source === null);
}
{
  // Alleen een geannuleerd abonnement, dan moet die wél gepakt worden.
  const r = reconcile(input({
    subs: [sub({ id: 'sub_a', display_id: 9, status: 'canceled', customer_email: 'k@x.nl' })],
    claims: [{ row: 2, agent: 'Davy', email: 'k@x.nl', sub_number: '' }],
  }), noExisting(), CONFIG, NOW);
  check('geannuleerd wordt wel gekoppeld als er niets anders is', r.rows[0].sheet_row === 2);
  check('en meldt de annulering', /canceled/.test(r.rowStatuses[0]?.text ?? ''), r.rowStatuses);
}
{
  // Twee upsells bij dezelfde klant, elk moet z'n eigen abonnement pakken.
  const r = reconcile(input({
    subs: [
      sub({ id: 'sub_x', display_id: 20, created_at: '2026-08-10T10:00:00Z', customer_email: 'k@x.nl' }),
      sub({ id: 'sub_y', display_id: 21, created_at: '2026-09-15T10:00:00Z', customer_email: 'k@x.nl' }),
    ],
    claims: [
      { row: 2, date: '10-08-2026', agent: 'Davy', email: 'k@x.nl' },
      { row: 3, date: '15-09-2026', agent: 'Nicolette', email: 'k@x.nl' },
    ],
  }), noExisting(), CONFIG, NOW);
  check('augustus-claim pakt de augustus-sub', r.rows.find(x => x.display_id === 20)?.sheet_row === 2);
  check('september-claim pakt de september-sub', r.rows.find(x => x.display_id === 21)?.sheet_row === 3);
}

// ── Abonnement bestaat maar valt buiten de periode ────────────────────
console.log('\nabonnement buiten de periode');
{
  // Het echte geval, sub #1306 op 6 aug terwijl het target op 7 aug begint.
  const r = reconcile(input({
    claims: [{ row: 2, agent: 'Bas', email: 'k@x.nl', sub_number: '110905' }],
    email_lookups: { 'k@x.nl': [{ display_id: 1306, status: 'active', created_at: '2026-08-06T10:38:03Z' }] },
  }), noExisting(), CONFIG, NOW);
  const t = r.rowStatuses[0]?.text ?? '';
  check('meldt dat het abonnement al bestaat', /#1306 exists on this email/.test(t), t);
  check('meldt dat het voor de startdatum is', /before the start date/.test(t), t);
  check('zegt niet meer dat het op activatie wacht', !/Waiting for activation/.test(t), t);
  check('telt als before_start', r.pending[0]?.reason === 'before_start', r.pending);
}
{
  // Geen abonnement bekend, dan blijft het gewoon wachten.
  const r = reconcile(input({
    claims: [{ row: 2, agent: 'Bas', email: 'k@x.nl' }],
    email_lookups: { 'k@x.nl': [] },
  }), noExisting(), CONFIG, NOW);
  check('zonder abonnement blijft het wachten', /Waiting for activation/.test(r.rowStatuses[0]?.text ?? ''), r.rowStatuses);
}

// ── Lege rijen ─────────────────────────────────────────────────────────
console.log('\nlege rijen');
{
  const r = reconcile(input({
    claims: [{ row: 2 }, { row: 3, note: '' }],
  }), noExisting(), CONFIG, NOW);
  check('lege rijen genegeerd', r.rowStatuses.length === 0 && r.pending.length === 0, { s: r.rowStatuses, p: r.pending });
}

// ── Sheet onbereikbaar ─────────────────────────────────────────────────
console.log('\nsheet onbereikbaar');
{
  const existing = new Map<string, ExistingSub>([['sub_a', {
    sub_id: 'sub_a', source: 'support', status: 'live',
    first_counted_at: '2026-08-20T10:00:00Z', canceled_detected_at: null,
    agent: 'Nicolette', hubspot_url: null, sheet_row: 4,
  }]]);
  const r = reconcile(input({
    sheet_ok: false,
    subs: [sub({ id: 'sub_a', display_id: 1 })],
    claims: [],
  }), existing, CONFIG, NOW);
  check('support-claim blijft staan', r.counts.support === 1 && r.counts.total === 1, r.counts);
  check('agent blijft behouden', r.rows[0].agent === 'Nicolette');
  check('geen statussen teruggeschreven', r.rowStatuses.length === 0, r.rowStatuses);
  check('waarschuwing gegeven', r.warnings.some(w => /Sheet unreadable/.test(w)), r.warnings);
}

// ── Medusa-id in plaats van nummer ─────────────────────────────────────
console.log('\nmedusa-id geplakt');
{
  const r = reconcile(input({
    subs: [sub({ id: 'sub_01ABCDEF', display_id: 42 })],
    claims: [{ row: 2, agent: 'Davy', email: 'x@y.nl', sub_number: 'sub_01ABCDEF' }],
  }), noExisting(), CONFIG, NOW);
  check('medusa-id werkt ook', r.counts.support === 1, r.counts);
}

console.log(`\n${passed} geslaagd, ${failed} gefaald\n`);
process.exit(failed === 0 ? 0 : 1);
