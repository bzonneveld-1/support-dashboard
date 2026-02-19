'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import Image from 'next/image';
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
  end.setUTCDate(end.getUTCDate() - 1);

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
  if (evening < morning) return 'text-emerald-600';
  if (evening > morning) return 'text-red-500';
  return '';
}

function getDeltaBg(morning: number | null, evening: number | null): string {
  if (morning == null || evening == null) return '';
  if (evening < morning) return 'bg-emerald-50';
  if (evening > morning) return 'bg-red-50';
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

  const totalCalls = days.reduce(
    (sum, d) => sum + (d.evening?.total_calls ?? d.morning?.total_calls ?? 0), 0,
  );
  const totalChat = days.reduce(
    (sum, d) => sum + (d.evening?.total_chatbot_chats ?? d.morning?.total_chatbot_chats ?? 0), 0,
  );
  const allOpenValues = days
    .flatMap(d => [d.morning?.all_open_tickets, d.evening?.all_open_tickets])
    .filter((v): v is number => v != null);
  const avgOpen = allOpenValues.length
    ? (allOpenValues.reduce((a, b) => a + b, 0) / allOpenValues.length).toFixed(1)
    : '—';

  if (loading && !data) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400 animate-pulse">Laden...</div>
      </div>
    );
  }

  const isCurrentWeek = weekParam === 'current' || (data && toWeekParam(data.week) === toWeekParam(getTodayStr()));

  return (
    <div className="h-screen flex flex-col px-6 py-4 lg:px-10 lg:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-5">
          <Image
            src="/bold-logo.png"
            alt="Bold"
            width={100}
            height={39}
            className="h-8 w-auto"
            priority
          />
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Support Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Week {weekInfo?.week} &middot; {data && formatDateRange(data.week, data.weekEnd)}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => data && setWeekParam(navigateWeek(data.week, -1))}
              className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors text-sm"
            >
              &#9664;
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekParam('current')}
                className="h-8 px-3 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
              >
                Vandaag
              </button>
            )}
            <button
              onClick={() => data && setWeekParam(navigateWeek(data.week, 1))}
              className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors text-sm"
            >
              &#9654;
            </button>
          </div>
        </div>
      </div>

      {/* Table - fills remaining space */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 min-h-0">
        <table className="w-full h-full border-collapse text-center">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 w-28">
                Dag
              </th>
              <th rowSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-200">
                Calls
              </th>
              <th rowSpan={2} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 border-l border-gray-200">
                Chatbot
              </th>
              {TICKET_METRICS.map(m => (
                <th
                  key={m.key}
                  colSpan={2}
                  className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 border-l border-gray-200"
                >
                  {m.label}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-50/60">
              {TICKET_METRICS.map(m => (
                <Fragment key={m.key}>
                  <th className="px-2 py-1.5 text-[10px] font-medium text-gray-400 border-b border-gray-200 border-l border-gray-200">
                    08:00
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-medium text-gray-400 border-b border-gray-200 border-l border-gray-100">
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
              const missingMorning = !day.isFuture && !day.morning;
              const missingEvening = !day.isFuture && !day.evening;

              return (
                <tr
                  key={day.date}
                  className={`
                    border-b border-gray-100 transition-colors
                    ${day.isToday ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'}
                    ${day.isFuture ? 'opacity-30' : ''}
                  `}
                  style={{ height: '20%' }}
                >
                  {/* Day */}
                  <td className="px-5 py-4 text-left font-medium border-r border-gray-100">
                    <span className={day.isToday ? 'text-blue-600' : 'text-gray-900'}>
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="ml-2 text-[10px] font-medium text-blue-400 uppercase tracking-wider">vandaag</span>
                    )}
                  </td>

                  {/* Calls (daily total) */}
                  <td className="px-4 py-4 border-l border-gray-100 tabular-nums">
                    {day.isFuture ? (
                      <span className="text-gray-200">—</span>
                    ) : dailyCalls != null ? (
                      <span className="text-2xl font-semibold text-gray-900">{dailyCalls}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Chatbot (daily total) */}
                  <td className="px-4 py-4 border-l border-gray-100 tabular-nums">
                    {day.isFuture ? (
                      <span className="text-gray-200">—</span>
                    ) : dailyChat != null ? (
                      <span className="text-2xl font-semibold text-gray-900">{dailyChat}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Ticket metrics: 08 + 18 */}
                  {TICKET_METRICS.map(metric => {
                    const morningVal = day.morning?.[metric.key] ?? null;
                    const eveningVal = day.evening?.[metric.key] ?? null;
                    const delta = formatDelta(morningVal, eveningVal);
                    const deltaColor = getDeltaColor(morningVal, eveningVal);
                    const deltaBg = getDeltaBg(morningVal, eveningVal);

                    return (
                      <Fragment key={metric.key}>
                        {/* 08:00 */}
                        <td className="px-3 py-4 border-l border-gray-100 tabular-nums">
                          {day.isFuture ? (
                            <span className="text-gray-200">—</span>
                          ) : morningVal != null ? (
                            <span className="text-2xl font-semibold text-gray-900">{morningVal}</span>
                          ) : missingMorning ? (
                            <MissingCell
                              backfilling={backfilling === `${day.date}-08:00`}
                              onBackfill={() => handleBackfill(day.date, '08:00')}
                            />
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>

                        {/* 18:00 */}
                        <td className={`px-3 py-4 border-l border-gray-50 tabular-nums rounded-sm ${deltaBg}`}>
                          {day.isFuture ? (
                            <span className="text-gray-200">—</span>
                          ) : eveningVal != null ? (
                            <span className="inline-flex items-baseline gap-1">
                              <span className={`text-2xl font-semibold ${deltaColor || 'text-gray-900'}`}>
                                {eveningVal}
                              </span>
                              {delta && (
                                <span className={`text-xs font-medium ${deltaColor} opacity-60`}>
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
                            <span className="text-gray-200">—</span>
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
            <tr className="bg-gray-50 border-t border-gray-200">
              <td className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" colSpan={3}>
                Week totaal
              </td>
              <td className="px-3 py-3 text-xs text-gray-500" colSpan={10}>
                <div className="flex items-center justify-center gap-8">
                  <span>
                    Calls: <strong className="text-gray-900 text-sm">{totalCalls}</strong>
                  </span>
                  <span>
                    Chatbot: <strong className="text-gray-900 text-sm">{totalChat}</strong>
                  </span>
                  <span>
                    Gem. All Open: <strong className="text-gray-900 text-sm">{avgOpen}</strong>
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
        <div>
          {lastUpdate && (
            <span>
              Laatste update: {lastUpdate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} CET
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
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
      title="Klik om data op te halen"
    >
      {backfilling ? (
        <span className="text-amber-500 animate-pulse text-sm">ophalen...</span>
      ) : (
        <>
          <span className="text-gray-300 text-lg">—</span>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Backfill
          </span>
        </>
      )}
    </button>
  );
}
