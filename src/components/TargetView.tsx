'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import NavHeader from './NavHeader';
import Confetti from './Confetti';

const POLL_MS = 15_000;

const SOURCE_COLOR = { direct_sales: '#0A84FF', support: '#1CF84C' } as const;
const SOURCE_LABEL = { direct_sales: 'Direct Sales', support: 'Support' } as const;

interface CountedSub {
  sub_id: string;
  display_id: number;
  source: 'direct_sales' | 'support';
  agent: string | null;
  counted_at: string | null;
}

interface TargetData {
  goal: number;
  total: number;
  direct_sales: number;
  support: number;
  canceled: number;
  pending: number;
  days_left: number;
  needed_per_week: number;
  actual_per_week: number;
  on_track: boolean;
  counted: CountedSub[];
}

interface Banner {
  key: number;
  kind: 'up' | 'down';
  title: string;
  subtitle: string;
  color: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function dec(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

/**
 * Telt zichtbaar op naar de nieuwe waarde in plaats van te springen.
 *
 * requestAnimationFrame staat volledig stil zolang het tabblad verborgen is,
 * dus de lus alleen is niet genoeg. Een timer zet het eindgetal er hoe dan ook
 * neer, anders blijft de teller op de vorige stand hangen terwijl de rest van
 * het scherm al bijgewerkt is.
 */
function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    let raf = 0;
    const startedAt = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);

    const settle = setTimeout(() => {
      setValue(target);
      fromRef.current = target;
    }, durationMs + 150);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [target, durationMs]);

  return value;
}

export default function TargetView() {
  const [data, setData] = useState<TargetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [celebrate, setCelebrate] = useState(0);
  const [dropPulse, setDropPulse] = useState(0);
  const [flashId, setFlashId] = useState<string | null>(null);

  const seenRef = useRef<Set<string> | null>(null);
  const bannerKey = useRef(0);

  const pushBanner = useCallback((b: Omit<Banner, 'key'>) => {
    const key = ++bannerKey.current;
    setBanners(prev => [...prev, { ...b, key }]);
    setTimeout(() => setBanners(prev => prev.filter(x => x.key !== key)), 8000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/target');
      if (!res.ok) return;                       // laatste goede stand blijft staan
      const json: TargetData = await res.json();

      const ids = new Set(json.counted.map(c => c.sub_id));
      const prev = seenRef.current;

      // Eerste load animeert nooit, anders viert de TV feest bij elke refresh.
      if (prev) {
        const added = json.counted.filter(c => !prev.has(c.sub_id));
        const removedCount = [...prev].filter(id => !ids.has(id)).length;

        added.forEach((sub, i) => {
          setTimeout(() => {
            pushBanner({
              kind: 'up',
              title: SOURCE_LABEL[sub.source],
              subtitle: [sub.agent, `#${sub.display_id}`].filter(Boolean).join('  ·  '),
              color: SOURCE_COLOR[sub.source],
            });
            setCelebrate(c => c + 1);
            setFlashId(sub.sub_id);
            setTimeout(() => setFlashId(null), 2600);
          }, i * 2000);
        });

        if (removedCount > 0) {
          pushBanner({
            kind: 'down',
            title: `−${removedCount}`,
            subtitle: removedCount === 1 ? 'subscription canceled' : 'subscriptions canceled',
            color: '#FF453A',
          });
          setDropPulse(p => p + 1);
        }
      }

      seenRef.current = ids;
      setData(json);
    } catch {
      // netwerkfout, volgende poll probeert opnieuw
    } finally {
      setLoading(false);
    }
  }, [pushBanner]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('tv')) {
      document.documentElement.setAttribute('data-tv', '');
      document.documentElement.style.setProperty('--card-gap', '150px');
    }
  }, []);

  const shown = useCountUp(data?.total ?? 0);

  if (loading && !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--dash-bg)]">
        <div className="text-lg text-[#8E8E93] animate-pulse">Loading...</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--dash-bg)]">
        <div className="text-lg text-[#8E8E93]">No data available</div>
      </div>
    );
  }

  const pct = data.goal > 0 ? Math.min(1, data.total / data.goal) : 0;
  const recent = [...data.counted]
    .sort((a, b) => (b.counted_at ?? '').localeCompare(a.counted_at ?? ''))
    .slice(0, 4);

  const R = 46;
  const C = 2 * Math.PI * R;
  const dsShare = data.total > 0 ? data.direct_sales / data.total : 0;

  return (
    <div className="dash-outer h-screen flex flex-col p-5 lg:p-8 bg-[var(--dash-bg)]">
      <NavHeader
        rightContent={
          <span className="text-xs text-[#8E8E93] whitespace-nowrap tabular-nums">
            {data.days_left} days left
          </span>
        }
      />

      <div
        className="target-card relative overflow-hidden bg-[var(--dash-surface)] rounded-2xl shadow-sm"
        style={{ height: 'calc(100vh - var(--card-gap, 7.5rem))' }}
      >
        <Confetti trigger={celebrate} />

        {/* Voortgangslijn over de volle breedte */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--dash-border)] z-10">
          <div
            className="h-full"
            style={{
              width: `${pct * 100}%`,
              background: `linear-gradient(90deg, ${SOURCE_COLOR.direct_sales}, ${SOURCE_COLOR.support})`,
              transition: 'width 1100ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>

        {/* Waar dit target voor is. Zonder deze regel is het een kaal getal. */}
        <div className="absolute top-[3.5%] left-[5%] z-20">
          <div
            className="uppercase"
            style={{ fontSize: 'min(1.5vh, 0.8vw)', letterSpacing: '0.28em', color: SOURCE_COLOR.support }}
          >
            Foosball target
          </div>
          <div
            className="text-[var(--dash-text)] opacity-70"
            style={{ fontSize: 'min(2.1vh, 1.12vw)', marginTop: '0.55em', letterSpacing: '-0.01em' }}
          >
            Bold pays the second half of the foosball table at 100
          </div>
        </div>

        {/* Meldingen. Gecentreerd boven de ring en niet boven het scherm, want
            in het midden dekken ze precies de cijfers af die net veranderden.
            26,5% is het hart van de linkerkolom van het raster hieronder. */}
        <div className="absolute top-[13%] left-[26.5%] -translate-x-1/2 z-30 flex flex-col items-center gap-[0.5em] pointer-events-none">
          {banners.map(b => (
            <div
              key={b.key}
              className="target-banner flex items-center gap-[0.7em] rounded-full pl-[0.55em] pr-[1.1em] py-[0.4em] backdrop-blur"
              style={{ backgroundColor: b.kind === 'up' ? b.color : 'rgba(255,69,58,0.95)' }}
            >
              <span
                className="flex items-center justify-center rounded-full font-bold tabular-nums"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.18)', color: b.kind === 'up' ? '#000' : '#fff',
                  width: '1.9em', height: '1.9em', fontSize: 'clamp(0.7rem, 1.5vh, 1.6rem)',
                }}
              >
                {b.kind === 'up' ? '+1' : b.title}
              </span>
              <span className="flex flex-col leading-tight" style={{ color: b.kind === 'up' ? '#000' : '#fff' }}>
                <span className="font-semibold tracking-tight" style={{ fontSize: 'clamp(0.8rem, 1.9vh, 2.1rem)' }}>
                  {b.kind === 'up' ? b.title : b.subtitle}
                </span>
                {b.kind === 'up' && b.subtitle && (
                  <span className="font-medium opacity-70" style={{ fontSize: 'clamp(0.6rem, 1.3vh, 1.4rem)' }}>
                    {b.subtitle}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Hoofdraster, hero links en cijfers rechts */}
        <div className="h-full grid" style={{ gridTemplateRows: '1fr auto' }}>
          <div
            className="grid items-center min-h-0"
            style={{ gridTemplateColumns: '1.05fr 1fr', paddingInline: '5%', columnGap: '5%' }}
          >
            {/* Hero */}
            <div className="flex items-center justify-center min-h-0 h-full">
              <div
                className={`relative ${dropPulse ? 'target-drop' : ''}`}
                key={`pulse-${dropPulse}`}
                style={{ width: 'min(56vh, 30vw)', height: 'min(56vh, 30vw)' }}
              >
                <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90 w-full h-full overflow-visible">
                  <circle cx="60" cy="60" r={R} fill="none" stroke="var(--dash-border)" strokeWidth="4" />
                  {/* Bij nul geen boog tekenen, anders blijft de ronde
                      lijnkap als los puntje staan. */}
                  {pct > 0 && (
                    <circle
                      cx="60" cy="60" r={R} fill="none"
                      stroke="url(#targetGrad)" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${pct * C} ${C}`}
                      style={{ transition: 'stroke-dasharray 1100ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                    />
                  )}
                  <defs>
                    <linearGradient id="targetGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={SOURCE_COLOR.direct_sales} />
                      <stop offset="100%" stopColor={SOURCE_COLOR.support} />
                    </linearGradient>
                  </defs>
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div
                    className="font-semibold tabular-nums text-[var(--dash-text)]"
                    style={{ fontSize: 'min(19vh, 10vw)', letterSpacing: '-0.045em', lineHeight: 0.92 }}
                  >
                    {shown}
                  </div>
                  <div
                    className="font-medium text-[#8E8E93] tabular-nums"
                    style={{ fontSize: 'min(3.4vh, 1.8vw)', marginTop: '0.35em', letterSpacing: '-0.01em' }}
                  >
                    of {data.goal}
                  </div>
                  <div
                    className="uppercase text-[#6E6E73]"
                    style={{ fontSize: 'min(1.45vh, 0.78vw)', letterSpacing: '0.32em', marginTop: '1.5em' }}
                  >
                    new subscriptions
                  </div>
                </div>
              </div>
            </div>

            {/* Cijfers */}
            <div className="flex flex-col justify-center min-h-0" style={{ gap: 'min(3.2vh, 1.7vw)' }}>
              <Section label="Source">
                <div className="flex flex-col" style={{ gap: 'min(1.5vh, 0.8vw)' }}>
                  <SourceRow label={SOURCE_LABEL.direct_sales} value={data.direct_sales} color={SOURCE_COLOR.direct_sales} />
                  <SourceRow label={SOURCE_LABEL.support} value={data.support} color={SOURCE_COLOR.support} />
                  {/* Zonder abonnementen is er niets te verdelen, dan alleen
                      de lege baan. Anders zou hij volledig groen kleuren. */}
                  <div className="flex h-[0.55em] w-full overflow-hidden rounded-full bg-[var(--dash-border)]"
                       style={{ fontSize: 'min(2.4vh, 1.3vw)', marginTop: '0.3em' }}>
                    {data.total > 0 && (
                      <>
                        <div style={{
                          width: `${dsShare * 100}%`, backgroundColor: SOURCE_COLOR.direct_sales,
                          transition: 'width 1100ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }} />
                        <div style={{
                          width: `${(1 - dsShare) * 100}%`, backgroundColor: SOURCE_COLOR.support,
                          transition: 'width 1100ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }} />
                      </>
                    )}
                  </div>
                </div>
              </Section>

              <Section label="Pace">
                <div className="flex items-end justify-between" style={{ gap: '1em' }}>
                  <Stat value={dec(data.actual_per_week)} unit="per week now"
                        color={data.on_track ? '#30D158' : '#FF9F0A'} />
                  <Stat value={dec(data.needed_per_week)} unit="per week needed" muted />
                  <Stat value={`${Math.round(pct * 100)}%`} unit="of target" muted />
                </div>
              </Section>

              {recent.length > 0 && (
                <Section label="Latest additions">
                  <div className="flex flex-col" style={{ gap: 'min(1.05vh, 0.56vw)' }}>
                    {recent.map(sub => (
                      <div
                        key={sub.sub_id}
                        className={`flex items-center tabular-nums ${flashId === sub.sub_id ? 'target-row-flash' : ''}`}
                        style={{ fontSize: 'min(1.85vh, 1vw)', gap: '0.9em' }}
                      >
                        <span className="inline-block rounded-full flex-shrink-0"
                              style={{ width: '0.5em', height: '0.5em', backgroundColor: SOURCE_COLOR[sub.source] }} />
                        <span className="font-medium text-[var(--dash-text)]" style={{ minWidth: '4.2em' }}>
                          #{sub.display_id}
                        </span>
                        <span className="text-[#8E8E93] truncate flex-1">
                          {sub.agent ?? SOURCE_LABEL[sub.source]}
                        </span>
                        <span className="text-[#6E6E73] flex-shrink-0">{fmtDay(sub.counted_at)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>

          {/* Voetregel */}
          <div
            className="flex items-center justify-between border-t border-[var(--dash-border)] text-[#6E6E73] tabular-nums"
            style={{ paddingInline: '5%', paddingBlock: 'min(1.6vh, 0.85vw)', fontSize: 'min(1.35vh, 0.72vw)' }}
          >
            <span className="uppercase" style={{ letterSpacing: '0.22em' }}>
              H2 2026
            </span>
            {/* Alleen tonen als er iets te melden valt. Een vaste "alles in
                orde"-regel is ruis op een scherm dat de hele dag aanstaat. */}
            <span style={{ letterSpacing: '0.06em' }}>
              {data.pending > 0 && `${data.pending} ${data.pending === 1 ? 'row' : 'rows'} awaiting activation`}
              {data.pending > 0 && data.canceled > 0 && '   ·   '}
              {data.canceled > 0 && `${data.canceled} canceled`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Onderdelen ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div
        className="uppercase text-[#6E6E73] border-b border-[var(--dash-border)]"
        style={{ fontSize: 'min(1.25vh, 0.67vw)', letterSpacing: '0.28em', paddingBottom: '0.9em', marginBottom: '1.1em' }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function SourceRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline justify-between" style={{ fontSize: 'min(2.4vh, 1.3vw)' }}>
      <span className="flex items-center gap-[0.6em] text-[var(--dash-text)]">
        <span className="inline-block rounded-full" style={{ width: '0.42em', height: '0.42em', backgroundColor: color }} />
        <span className="font-medium tracking-tight">{label}</span>
      </span>
      <span
        className="font-semibold tabular-nums text-[var(--dash-text)]"
        style={{ fontSize: 'min(4.2vh, 2.3vw)', letterSpacing: '-0.03em' }}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({ value, unit, color, muted }: { value: string; unit: string; color?: string; muted?: boolean }) {
  return (
    <div className="flex flex-col">
      <span
        className="font-semibold tabular-nums"
        style={{
          fontSize: 'min(3.4vh, 1.85vw)', letterSpacing: '-0.03em',
          color: color ?? (muted ? 'var(--dash-text)' : 'var(--dash-text)'),
          opacity: muted ? 0.75 : 1,
        }}
      >
        {value}
      </span>
      <span className="uppercase text-[#6E6E73]" style={{ fontSize: 'min(1.15vh, 0.62vw)', letterSpacing: '0.16em', marginTop: '0.5em' }}>
        {unit}
      </span>
    </div>
  );
}
