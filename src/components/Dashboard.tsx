'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { triggerBackfill } from '@/app/actions';

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
}

// ============ Constants ============

const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const REFRESH_MS = 5 * 60 * 1000;

type MetricKey = 'unassigned_tickets' | 'all_open_tickets' | 'whatsapp_all_open' | 'whatsapp_waiting_on_us' | 'waiting_on_us';

const TICKET_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'unassigned_tickets', label: 'Unassigned' },
  { key: 'all_open_tickets', label: 'All Open' },
  { key: 'whatsapp_all_open', label: 'WA All Open' },
  { key: 'whatsapp_waiting_on_us', label: 'WA WoU' },
  { key: 'waiting_on_us', label: 'Waiting on Us' },
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
  end.setUTCDate(end.getUTCDate() - 1); // endDate is next Monday (exclusive), -1 = Sunday

  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS_NL[start.getUTCMonth()];
  const endMonth = MONTHS_NL[end.getUTCMonth()];
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${endMonth} ${year}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
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

  for (let i = 0; i < 5; i++) {
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
    });
  }

  return days;
}

function getDeltaColor(morning: number | null, evening: number | null): string {
  if (morning == null || evening == null) return '';
  if (evening < morning) return 'text-green-400';
  if (evening > morning) return 'text-red-400';
  return '';
}

function getDeltaBg(morning: number | null, evening: number | null): string {
  if (morning == null || evening == null) return '';
  if (evening < morning) return 'bg-green-500/10';
  if (evening > morning) return 'bg-red-500/10';
  return '';
}

function formatDelta(morning: number | null, evening: number | null): string {
  if (morning == null || evening == null) return '';
  const diff = evening - morning;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return '';
}

// ============ Component ============

export default function Dashboard() {
  const [weekParam, setWeekParam] = useState('current');
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/metrics?week=${weekParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekParam]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setInterval(() => fetchData(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  const handleBackfill = async (date: string, timeSlot: string) => {
    const key = `${date}-${timeSlot}`;
    setBackfilling(key);
    try {
      await triggerBackfill(date, timeSlot);
      // Wait for n8n to process, then refresh
      setTimeout(() => fetchData(true), 8000);
    } catch {
      console.error('Backfill failed');
    } finally {
      setTimeout(() => setBackfilling(null), 8000);
    }
  };

  // Computed
  const days = data ? buildWeekDays(data.week, data.metrics) : [];
  const weekInfo = data ? getISOWeek(data.week) : null;

  // Summary stats
  const totalCalls = days.reduce(
    (sum, d) => sum + (d.evening?.total_calls ?? d.morning?.total_calls ?? 0),
    0,
  );
  const totalChat = days.reduce(
    (sum, d) => sum + (d.evening?.total_chatbot_chats ?? d.morning?.total_chatbot_chats ?? 0),
    0,
  );
  const allOpenValues = days
    .flatMap(d => [d.morning?.all_open_tickets, d.evening?.all_open_tickets])
    .filter((v): v is number => v != null);
  const avgOpen = allOpenValues.length
    ? (allOpenValues.reduce((a, b) => a + b, 0) / allOpenValues.length).toFixed(1)
    : '—';
  const latestCollectedAt = data?.metrics
    .map(m => m.collected_at)
    .filter(Boolean)
    .sort()
    .pop();

  // Loading state
  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-400 animate-pulse">Laden...</div>
      </div>
    );
  }

  const isCurrentWeek = weekParam === 'current' || (data && toWeekParam(data.week) === toWeekParam(getTodayStr()));

  return (
    <div className="min-h-screen p-4 lg:p-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">Support Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-base lg:text-lg text-gray-400">
            Week {weekInfo?.week} &middot; {data && formatDateRange(data.week, data.weekEnd)}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => data && setWeekParam(navigateWeek(data.week, -1))}
              className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
              title="Vorige week"
            >
              &#9664;
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekParam('current')}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
              >
                Vandaag
              </button>
            )}
            <button
              onClick={() => data && setWeekParam(navigateWeek(data.week, 1))}
              className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
              title="Volgende week"
            >
              &#9654;
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full border-collapse text-center">
          <thead>
            {/* Row 1: metric group headers */}
            <tr className="bg-gray-800/80">
              <th rowSpan={2} className="px-4 py-3 text-left text-sm font-semibold text-gray-300 border-b border-gray-700 w-28">
                Dag
              </th>
              <th rowSpan={2} className="px-3 py-3 text-sm font-semibold text-gray-300 border-b border-gray-700 border-l border-gray-700">
                Calls
              </th>
              <th rowSpan={2} className="px-3 py-3 text-sm font-semibold text-gray-300 border-b border-gray-700 border-l border-gray-700">
                Chatbot
              </th>
              {TICKET_METRICS.map(m => (
                <th
                  key={m.key}
                  colSpan={2}
                  className="px-3 py-2 text-sm font-semibold text-gray-300 border-b border-gray-700/50 border-l border-gray-700"
                >
                  {m.label}
                </th>
              ))}
            </tr>
            {/* Row 2: 08 / 18 sub-headers */}
            <tr className="bg-gray-800/40">
              {TICKET_METRICS.map(m => (
                <Fragment key={m.key}>
                  <th className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-700 border-l border-gray-700">
                    08:00
                  </th>
                  <th className="px-2 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-700 border-l border-gray-700/30">
                    18:00
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const dailyCalls = day.evening?.total_calls ?? day.morning?.total_calls ?? null;
              const dailyChat = day.evening?.total_chatbot_chats ?? day.morning?.total_chatbot_chats ?? null;
              const hasMorning = day.morning !== null;
              const hasEvening = day.evening !== null;
              const missingMorning = !day.isFuture && !hasMorning;
              const missingEvening = !day.isFuture && !hasEvening;

              return (
                <tr
                  key={day.date}
                  className={`
                    border-b border-gray-800 transition-colors
                    ${day.isToday ? 'bg-blue-950/30' : 'hover:bg-gray-900/50'}
                    ${day.isFuture ? 'opacity-40' : ''}
                  `}
                >
                  {/* Day name */}
                  <td className="px-4 py-3 text-left font-medium border-r border-gray-800">
                    <span className={day.isToday ? 'text-blue-400' : ''}>
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="ml-2 text-xs text-blue-400/60">vandaag</span>
                    )}
                  </td>

                  {/* Calls */}
                  <td className="px-3 py-3 border-l border-gray-800 tabular-nums">
                    {day.isFuture ? (
                      <span className="text-gray-700">—</span>
                    ) : dailyCalls != null ? (
                      <span className="text-xl font-semibold">{dailyCalls}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Chatbot */}
                  <td className="px-3 py-3 border-l border-gray-800 tabular-nums">
                    {day.isFuture ? (
                      <span className="text-gray-700">—</span>
                    ) : dailyChat != null ? (
                      <span className="text-xl font-semibold">{dailyChat}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Ticket metrics: 08 + 18 per metric */}
                  {TICKET_METRICS.map(metric => {
                    const morningVal = day.morning?.[metric.key] ?? null;
                    const eveningVal = day.evening?.[metric.key] ?? null;
                    const delta = formatDelta(morningVal, eveningVal);
                    const deltaColor = getDeltaColor(morningVal, eveningVal);
                    const deltaBg = getDeltaBg(morningVal, eveningVal);

                    return (
                      <Fragment key={metric.key}>
                        {/* 08:00 */}
                        <td className="px-3 py-3 border-l border-gray-800 tabular-nums">
                          {day.isFuture ? (
                            <span className="text-gray-700">—</span>
                          ) : morningVal != null ? (
                            <span className="text-xl font-semibold">{morningVal}</span>
                          ) : missingMorning ? (
                            <MissingCell
                              backfilling={backfilling === `${day.date}-08:00`}
                              onBackfill={() => handleBackfill(day.date, '08:00')}
                            />
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>

                        {/* 18:00 */}
                        <td className={`px-3 py-3 border-l border-gray-800/30 tabular-nums ${deltaBg}`}>
                          {day.isFuture ? (
                            <span className="text-gray-700">—</span>
                          ) : eveningVal != null ? (
                            <span className="inline-flex items-baseline gap-1">
                              <span className={`text-xl font-semibold ${deltaColor}`}>
                                {eveningVal}
                              </span>
                              {delta && (
                                <span className={`text-xs ${deltaColor} opacity-70`}>
                                  {delta}
                                </span>
                              )}
                            </span>
                          ) : missingEvening ? (
                            <MissingCell
                              backfilling={backfilling === `${day.date}-18:00`}
                              onBackfill={() => handleBackfill(day.date, '18:00')}
                            />
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Summary footer */}
          <tfoot>
            <tr className="bg-gray-800/50 border-t border-gray-700">
              <td className="px-4 py-3 text-left text-sm font-semibold text-gray-400" colSpan={3}>
                WEEK TOTAAL
              </td>
              <td className="px-3 py-3 text-sm text-gray-400" colSpan={10}>
                <div className="flex items-center justify-center gap-8">
                  <span>
                    Calls: <strong className="text-gray-200 text-base">{totalCalls}</strong>
                  </span>
                  <span>
                    Chatbot: <strong className="text-gray-200 text-base">{totalChat}</strong>
                  </span>
                  <span>
                    Gem. All Open: <strong className="text-gray-200 text-base">{avgOpen}</strong>
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm text-gray-500 gap-2">
        <div>
          {lastUpdate && (
            <span>
              Laatste update: {lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} CET
            </span>
          )}
          {latestCollectedAt && (
            <span className="ml-4">
              Data verzameld: {new Date(latestCollectedAt).toLocaleString('nl-NL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          {refreshing ? 'Vernieuwen...' : 'Vernieuwen'}
        </button>
      </div>
    </div>
  );
}

// ============ Sub-components ============

function MissingCell({ backfilling, onBackfill }: { backfilling: boolean; onBackfill: () => void }) {
  return (
    <button
      onClick={onBackfill}
      disabled={backfilling}
      className="group relative"
      title="Klik om data op te halen (backfill)"
    >
      {backfilling ? (
        <span className="text-amber-400 animate-pulse text-sm">ophalen...</span>
      ) : (
        <>
          <span className="text-amber-500/50 text-lg">-</span>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-700 text-xs text-gray-300 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Backfill
          </span>
        </>
      )}
    </button>
  );
}
