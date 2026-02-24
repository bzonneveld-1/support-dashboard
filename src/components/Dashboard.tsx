'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { triggerBackfill } from '@/app/actions';
import NavHeader from './NavHeader';
import { useDataVersion } from '@/hooks/useDataVersion';

// ============ Types ============

interface MetricsRow {
  id: number;
  metric_date: string;
  time_slot: string;
  unassigned_tickets: number | null;
  all_open_tickets: number | null;
  whatsapp_all_open: number | null;
  whatsapp_waiting_on_us: number | null;
  waiting_on_us: number | null;
  total_calls: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
  revenue_mtd: number | null;
  revenue_daily: number | null;
  subscriptions_active: number | null;
  subscriptions_new: number | null;
  collected_at: string;
  created_at: string;
}

interface WeekData {
  week: string;
  weekEnd: string;
  metrics: MetricsRow[];
}

interface DayData {
  date: string;
  dayName: string;
  isToday: boolean;
  isFuture: boolean;
  morning: MetricsRow | null;
  evening: MetricsRow | null;
  latest: MetricsRow | null;
}

// ============ Constants ============

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REFRESH_MS = 5 * 60 * 1000;

type TicketMetricKey = 'unassigned_tickets' | 'all_open_tickets';

const TICKET_METRICS: { key: TicketMetricKey; label: string }[] = [
  { key: 'unassigned_tickets', label: 'Unassigned' },
  { key: 'all_open_tickets', label: 'All Open' },
];

// ============ Helpers ============

function getISOWeek(dateStr: string): { year: number; week: number } {
  const date = new Date(dateStr + 'T12:00:00Z');
  const dayOfWeek = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: thursday.getUTCFullYear(), week: weekNumber };
}

function toWeekParam(dateStr: string): string {
  const { year, week } = getISOWeek(dateStr);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function navigateWeek(mondayStr: string, direction: -1 | 1): string {
  const date = new Date(mondayStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + direction * 7);
  return toWeekParam(date.toISOString().split('T')[0]);
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() - 1);

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${endMonth} ${year}`;
  }
  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${year}`;
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDate(d: string): string {
  return d.split('T')[0];
}

function buildWeekDays(weekStart: string, metrics: MetricsRow[]): DayData[] {
  const today = getTodayStr();
  const days: DayData[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    days.push({
      date: dateStr,
      dayName: DAY_NAMES[i],
      isToday: dateStr === today,
      isFuture: dateStr > today,
      morning: metrics.find(m => normalizeDate(m.metric_date) === dateStr && m.time_slot === '08:00') || null,
      evening: metrics.find(m => normalizeDate(m.metric_date) === dateStr && m.time_slot === '18:00') || null,
      latest: metrics.find(m => normalizeDate(m.metric_date) === dateStr && m.time_slot === 'latest') || null,
    });
  }

  return days;
}

function getDeltaColor(morning: number | null, evening: number | null): string {
  if (morning == null || evening == null) return '';
  if (evening < morning) return 'text-[#34C759]';
  if (evening > morning) return 'text-[#FF3B30]';
  return '';
}

// Daily Totals: prefer latest, fallback to evening (backward compat for pre-hourly days)
function getDailyValue(day: DayData, key: keyof MetricsRow): number | null {
  const latestVal = day.latest?.[key];
  if (latestVal != null && typeof latestVal === 'number') return latestVal;
  const eveningVal = day.evening?.[key];
  if (eveningVal != null && typeof eveningVal === 'number') return eveningVal;
  return null;
}

// Webshop: only from latest (Medusa data is never in morning/evening rows)
function getWebshopValue(day: DayData, key: keyof MetricsRow): number | null {
  const val = day.latest?.[key];
  if (val != null && typeof val === 'number') return val;
  return null;
}

// Dutch euro formatting: €12.345 (dot = thousands separator, no decimals)
function fmtEuros(euros: number): string {
  const str = Math.abs(euros).toString();
  const parts = [];
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.slice(Math.max(0, i - 3), i));
  }
  return parts.join('.');
}

function formatCurrency(cents: number | null): string {
  if (cents == null) return '—';
  const euros = Math.round(cents / 100);
  return (euros < 0 ? '-€' : '€') + fmtEuros(euros);
}

function avgOf(values: number[]): string {
  if (!values.length) return '—';
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
}

// ============ Component ============

export default function Dashboard() {
  const [weekParam, setWeekParam] = useState('current');
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/metrics?week=${weekParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [weekParam]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setInterval(() => fetchData(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  useDataVersion(fetchData);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('tv')) {
      document.documentElement.setAttribute('data-tv', '');
    }
  }, []);

  const handleBackfill = async (date: string, timeSlot: string) => {
    const key = `${date}-${timeSlot}`;
    setBackfilling(key);
    try {
      await triggerBackfill(date, timeSlot);
    } catch {
      console.error('Backfill failed');
    } finally {
      setTimeout(() => setBackfilling(null), 8000);
    }
  };

  // Computed
  const days = data ? buildWeekDays(data.week, data.metrics) : [];
  const weekInfo = data ? getISOWeek(data.week) : null;

  // Footer: Daily Totals sums (uses latest, fallback evening)
  const totalCalls = days.reduce((sum, d) => sum + (getDailyValue(d, 'total_calls') ?? 0), 0);
  const totalChat = days.reduce((sum, d) => sum + (getDailyValue(d, 'total_chatbot_chats') ?? 0), 0);
  const totalEmails = days.reduce((sum, d) => sum + (getDailyValue(d, 'total_emails') ?? 0), 0);
  const totalWaMsgs = days.reduce((sum, d) => sum + (getDailyValue(d, 'total_wa_messages') ?? 0), 0);

  // Footer: Ticket Snapshot averages (always from morning/evening)
  const avgUnassigned08 = avgOf(days.map(d => d.morning?.unassigned_tickets).filter((v): v is number => v != null));
  const avgUnassigned18 = avgOf(days.map(d => d.evening?.unassigned_tickets).filter((v): v is number => v != null));
  const avgAllOpen08 = avgOf(days.map(d => d.morning?.all_open_tickets).filter((v): v is number => v != null));
  const avgAllOpen18 = avgOf(days.map(d => d.evening?.all_open_tickets).filter((v): v is number => v != null));

  // Footer: Revenue MTD growth (with month boundary detection)
  const daysWithMtd = days.filter(d => getWebshopValue(d, 'revenue_mtd') != null);
  const mondayMonth = days[0] ? new Date(days[0].date + 'T12:00:00Z').getUTCMonth() : null;
  const lastMtdDay = daysWithMtd[daysWithMtd.length - 1];
  const lastMtdMonth = lastMtdDay ? new Date(lastMtdDay.date + 'T12:00:00Z').getUTCMonth() : null;
  const crossesMonthBoundary = mondayMonth !== null && lastMtdMonth !== null && mondayMonth !== lastMtdMonth;

  let revMtdGrowthStr = '—';
  if (!crossesMonthBoundary && daysWithMtd.length >= 2) {
    const firstMtd = getWebshopValue(daysWithMtd[0], 'revenue_mtd')!;
    const lastMtd = getWebshopValue(lastMtdDay, 'revenue_mtd')!;
    const diffCents = lastMtd - firstMtd;
    const diffEuros = Math.round(diffCents / 100);
    revMtdGrowthStr = (diffEuros >= 0 ? '+€' : '-€') + fmtEuros(diffEuros);
  }

  // Footer: Average daily revenue
  const dailyRevValues = days.map(d => getWebshopValue(d, 'revenue_daily')).filter((v): v is number => v != null);
  const avgDailyRev = dailyRevValues.length
    ? formatCurrency(Math.round(dailyRevValues.reduce((a, b) => a + b, 0) / dailyRevValues.length))
    : '—';

  // Footer: Subs Active growth
  const daysWithSubs = days.filter(d => getWebshopValue(d, 'subscriptions_active') != null);
  let subsGrowthStr = '—';
  if (daysWithSubs.length >= 2) {
    const firstSubs = getWebshopValue(daysWithSubs[0], 'subscriptions_active')!;
    const lastSubs = getWebshopValue(daysWithSubs[daysWithSubs.length - 1], 'subscriptions_active')!;
    const diff = lastSubs - firstSubs;
    subsGrowthStr = (diff >= 0 ? '+' : '') + diff;
  }

  // Footer: Average new subs per day
  const newSubsValues = days.map(d => getWebshopValue(d, 'subscriptions_new')).filter((v): v is number => v != null);
  const avgNewSubs = avgOf(newSubsValues);

  // Last updated timestamp (from today's latest row)
  const todayDay = days.find(d => d.isToday);
  let lastUpdatedTime: string | null = null;
  if (todayDay?.latest?.collected_at) {
    const d = new Date(todayDay.latest.collected_at);
    lastUpdatedTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  if (loading && !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--dash-bg)]">
        <div className="text-lg text-[#8E8E93] animate-pulse">Loading...</div>
      </div>
    );
  }

  const isCurrentWeek = weekParam === 'current' || (data && toWeekParam(data.week) === toWeekParam(getTodayStr()));

  return (
    <div className="dash-outer h-screen flex flex-col p-5 lg:p-8 bg-[var(--dash-bg)]">
      <div className="tv-hide">
      <NavHeader
        rightContent={
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8E8E93]">
              Week {weekInfo?.week} &middot; {data && formatDateRange(data.week, data.weekEnd)}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => data && setWeekParam(navigateWeek(data.week, -1))}
                className="w-7 h-7 rounded-md hover:bg-[var(--dash-hover)] flex items-center justify-center text-[#8E8E93] hover:text-[var(--dash-text)] transition-colors text-xs"
              >
                &#9664;
              </button>
              {!isCurrentWeek && (
                <button
                  onClick={() => setWeekParam('current')}
                  className="h-7 px-2.5 rounded-md bg-[#007AFF] text-white text-[0.6875rem] font-medium hover:bg-[#0071E3] transition-colors"
                >
                  Today
                </button>
              )}
              <button
                onClick={() => data && setWeekParam(navigateWeek(data.week, 1))}
                className="w-7 h-7 rounded-md hover:bg-[var(--dash-hover)] flex items-center justify-center text-[#8E8E93] hover:text-[var(--dash-text)] transition-colors text-xs"
              >
                &#9654;
              </button>
            </div>
          </div>
        }
      />
      </div>

      {/* Table card */}
      <div className="overflow-hidden bg-[var(--dash-surface)] rounded-2xl shadow-sm flex flex-col" style={{ height: 'calc(100vh - var(--card-gap, 7.5rem))' }}>
        <div className="flex-1 min-h-0">
          <table className="w-full h-full border-collapse text-center">
            <thead className="sticky top-0 z-10">
              {/* Row 1: Group labels — 1 + 4 + 4 + 4 = 13 columns */}
              <tr className="bg-[#1D1D1F]">
                <th rowSpan={3} className="px-5 py-2 text-left text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider w-[7.5rem] border-r border-[#343436]">
                  Day
                </th>
                <th colSpan={4} className="px-4 pt-2.5 pb-0.5 text-[0.6875rem] font-semibold text-[#B3B3B5] uppercase tracking-[0.12em]" style={{ borderRight: '5px solid var(--dash-split)' }}>
                  Daily Totals
                </th>
                <th colSpan={4} className="px-4 pt-2.5 pb-0.5 text-[0.6875rem] font-semibold text-[#B3B3B5] uppercase tracking-[0.12em]" style={{ borderRight: '5px solid var(--dash-split)' }}>
                  Ticket Snapshots
                </th>
                <th colSpan={4} className="px-4 pt-2.5 pb-0.5 text-[0.6875rem] font-semibold text-[#B3B3B5] uppercase tracking-[0.12em]">
                  Webshop
                </th>
              </tr>
              {/* Row 2: Column names */}
              <tr className="bg-[#1D1D1F]">
                {/* Daily Totals — rowSpan=2 */}
                <th rowSpan={2} className="px-4 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Total Calls</th>
                <th rowSpan={2} className="px-4 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Chatbot Chats</th>
                <th rowSpan={2} className="px-4 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Emails Sent</th>
                <th rowSpan={2} className="px-4 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider" style={{ borderRight: '5px solid var(--dash-split)' }}>WhatsApps Sent</th>
                {/* Ticket Snapshots — colSpan=2 each */}
                {TICKET_METRICS.map((m, i) => (
                  <th
                    key={m.key}
                    colSpan={2}
                    className={`px-3 py-1 text-[0.6875rem] font-medium text-white uppercase tracking-wider ${i > 0 ? 'border-l border-[#2B2B2D]' : ''}`}
                    style={i === TICKET_METRICS.length - 1 ? { borderRight: '5px solid var(--dash-split)' } : undefined}
                  >
                    {m.label}
                  </th>
                ))}
                {/* Webshop — rowSpan=2 */}
                <th rowSpan={2} className="px-3 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Rev MTD</th>
                <th rowSpan={2} className="px-3 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Rev Daily</th>
                <th rowSpan={2} className="px-3 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Subs Active</th>
                <th rowSpan={2} className="px-3 py-1 text-[0.6875rem] font-medium text-[#B3B3B5] uppercase tracking-wider">Subs New</th>
              </tr>
              {/* Row 3: 08/18 sub-headers for ticket metrics only */}
              <tr className="bg-[#1D1D1F]">
                {TICKET_METRICS.map((m, i) => (
                  <Fragment key={m.key}>
                    <th className={`px-2 pb-1.5 text-[0.625rem] font-medium text-[#9D9DA0] ${i > 0 ? 'border-l border-[#2B2B2D]' : ''}`}>
                      08
                    </th>
                    <th
                      className="px-2 pb-1.5 text-[0.625rem] font-medium text-[#9D9DA0]"
                      style={i === TICKET_METRICS.length - 1 ? { borderRight: '5px solid var(--dash-split)' } : undefined}
                    >
                      18
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, dayIdx) => {
                const dailyCalls = getDailyValue(day, 'total_calls');
                const dailyChat = getDailyValue(day, 'total_chatbot_chats');
                const dailyEmails = getDailyValue(day, 'total_emails');
                const dailyWaMsgs = getDailyValue(day, 'total_wa_messages');
                const revMtd = getWebshopValue(day, 'revenue_mtd');
                const revDaily = getWebshopValue(day, 'revenue_daily');
                const subsActive = getWebshopValue(day, 'subscriptions_active');
                const subsNew = getWebshopValue(day, 'subscriptions_new');

                return (
                  <tr
                    key={day.date}
                    className={`
                      border-b border-[var(--dash-border)] transition-colors
                      ${day.isToday ? 'bg-[var(--dash-today)]' : dayIdx % 2 === 1 ? 'bg-[var(--dash-alt)]' : ''}
                      ${day.isFuture ? 'opacity-20' : ''}
                    `}
                    style={{ height: `${100 / 7}%` }}
                  >
                    {/* Day name */}
                    <td className="px-5 py-2.5 text-left relative border-r border-[var(--dash-border)]">
                      {day.isToday && (
                        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#007AFF]" />
                      )}
                      <span className={`text-[0.8125rem] font-medium ${day.isToday ? 'text-[#007AFF]' : 'text-[var(--dash-text)]'}`}>
                        {day.dayName}
                      </span>
                      {day.isToday && (
                        <span className="ml-1.5 text-[0.5625rem] font-medium text-[#66ADFF] uppercase tracking-widest">today</span>
                      )}
                    </td>

                    {/* Daily Totals: Total Calls */}
                    <td className="px-4 py-2.5 tabular-nums">
                      <DailyCell day={day} value={dailyCalls} backfilling={backfilling === `${day.date}-18:00`} onBackfill={() => handleBackfill(day.date, '18:00')} />
                    </td>

                    {/* Chatbot Chats */}
                    <td className="px-4 py-2.5 tabular-nums">
                      <DailyCell day={day} value={dailyChat} backfilling={backfilling === `${day.date}-18:00`} onBackfill={() => handleBackfill(day.date, '18:00')} />
                    </td>

                    {/* Emails Sent */}
                    <td className="px-4 py-2.5 tabular-nums">
                      <DailyCell day={day} value={dailyEmails} backfilling={backfilling === `${day.date}-18:00`} onBackfill={() => handleBackfill(day.date, '18:00')} />
                    </td>

                    {/* WhatsApps Sent — split line right */}
                    <td className="px-4 py-2.5 tabular-nums" style={{ borderRight: '5px solid var(--dash-split)' }}>
                      <DailyCell day={day} value={dailyWaMsgs} backfilling={backfilling === `${day.date}-18:00`} onBackfill={() => handleBackfill(day.date, '18:00')} />
                    </td>

                    {/* Ticket Snapshots: 08 + 18 per metric */}
                    {TICKET_METRICS.map((metric, groupIdx) => {
                      const morningVal = day.morning?.[metric.key] ?? null;
                      const eveningVal = day.evening?.[metric.key] ?? null;
                      const deltaColor = getDeltaColor(morningVal, eveningVal);
                      const isLast = groupIdx === TICKET_METRICS.length - 1;

                      return (
                        <Fragment key={metric.key}>
                          {/* 08:00 */}
                          <td className={`py-2.5 tabular-nums ${groupIdx === 0 ? 'pl-5 pr-3' : 'px-3 border-l border-[var(--dash-bg)]'}`}>
                            {day.isFuture ? (
                              <span className="text-[var(--dash-muted)]">—</span>
                            ) : morningVal != null ? (
                              <span className="text-xl font-medium text-[var(--dash-text)]">{morningVal}</span>
                            ) : (
                              <span className="text-[var(--dash-muted)]">—</span>
                            )}
                          </td>
                          {/* 18:00 — color retained, delta text removed */}
                          <td
                            className="px-3 py-2.5 tabular-nums"
                            style={isLast ? { borderRight: '5px solid var(--dash-split)' } : undefined}
                          >
                            {day.isFuture ? (
                              <span className="text-[var(--dash-muted)]">—</span>
                            ) : eveningVal != null ? (
                              <span className={`text-xl font-medium ${deltaColor || 'text-[var(--dash-text)]'}`}>
                                {eveningVal}
                              </span>
                            ) : (
                              <span className="text-[var(--dash-muted)]">—</span>
                            )}
                          </td>
                        </Fragment>
                      );
                    })}

                    {/* Webshop: Rev MTD */}
                    <td className="px-3 py-2.5 tabular-nums">
                      {day.isFuture ? (
                        <span className="text-[var(--dash-muted)]">—</span>
                      ) : revMtd != null ? (
                        <span className="text-xl font-medium text-[var(--dash-text)]">{formatCurrency(revMtd)}</span>
                      ) : (
                        <span className="text-[var(--dash-muted)]">—</span>
                      )}
                    </td>

                    {/* Rev Daily */}
                    <td className="px-3 py-2.5 tabular-nums">
                      {day.isFuture ? (
                        <span className="text-[var(--dash-muted)]">—</span>
                      ) : revDaily != null ? (
                        <span className="text-xl font-medium text-[var(--dash-text)]">{formatCurrency(revDaily)}</span>
                      ) : (
                        <span className="text-[var(--dash-muted)]">—</span>
                      )}
                    </td>

                    {/* Subs Active */}
                    <td className="px-3 py-2.5 tabular-nums">
                      {day.isFuture ? (
                        <span className="text-[var(--dash-muted)]">—</span>
                      ) : subsActive != null ? (
                        <span className="text-xl font-medium text-[var(--dash-text)]">{subsActive}</span>
                      ) : (
                        <span className="text-[var(--dash-muted)]">—</span>
                      )}
                    </td>

                    {/* Subs New */}
                    <td className="px-3 py-2.5 tabular-nums">
                      {day.isFuture ? (
                        <span className="text-[var(--dash-muted)]">—</span>
                      ) : subsNew != null ? (
                        <span className="text-xl font-medium text-[var(--dash-text)]">{subsNew}</span>
                      ) : (
                        <span className="text-[var(--dash-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Footer: individual cells per column — 13 cells total */}
            <tfoot>
              <tr className="border-t-2 border-[var(--dash-border)]">
                {/* Day */}
                <td className="px-5 py-2.5 text-left border-r border-[var(--dash-border)]">
                  <span className="text-[0.6875rem] font-medium text-[#8E8E93] uppercase tracking-wider">Summary</span>
                </td>

                {/* Daily Totals: sums */}
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{totalCalls}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{totalChat}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{totalEmails}</span>
                </td>
                <td className="py-2.5 tabular-nums" style={{ borderRight: '5px solid var(--dash-split)' }}>
                  <span className="text-[var(--dash-text)] text-sm font-medium">{totalWaMsgs}</span>
                </td>

                {/* Ticket Snapshots: averages (08 + 18 per metric) */}
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{avgUnassigned08}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{avgUnassigned18}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{avgAllOpen08}</span>
                </td>
                <td className="py-2.5 tabular-nums" style={{ borderRight: '5px solid var(--dash-split)' }}>
                  <span className="text-[var(--dash-text)] text-sm font-medium">{avgAllOpen18}</span>
                </td>

                {/* Webshop: growth / averages */}
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{revMtdGrowthStr}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{avgDailyRev}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{subsGrowthStr}</span>
                </td>
                <td className="py-2.5 tabular-nums">
                  <span className="text-[var(--dash-text)] text-sm font-medium">{avgNewSubs}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Last updated timestamp */}
        {lastUpdatedTime && (
          <div className="text-center py-1.5 text-[0.625rem] text-[#8E8E93] flex-shrink-0">
            Last updated: {lastUpdatedTime}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Sub-components ============

function DailyCell({ day, value, backfilling, onBackfill }: {
  day: DayData;
  value: number | null;
  backfilling: boolean;
  onBackfill: () => void;
}) {
  if (day.isFuture) {
    return <span className="text-[var(--dash-muted)]">—</span>;
  }
  if (value != null) {
    return <span className="text-xl font-medium text-[var(--dash-text)]">{value}</span>;
  }
  if (day.isToday) {
    return <span className="text-[var(--dash-muted)]">—</span>;
  }
  return <MissingCell backfilling={backfilling} onBackfill={onBackfill} />;
}

function MissingCell({ backfilling, onBackfill }: { backfilling: boolean; onBackfill: () => void }) {
  return (
    <button
      onClick={onBackfill}
      disabled={backfilling}
      className="group relative"
      title="Click to fetch data"
    >
      {backfilling ? (
        <span className="text-[#FF9500] animate-pulse text-xs">fetching...</span>
      ) : (
        <span className="text-[var(--dash-muted)]">—</span>
      )}
    </button>
  );
}
