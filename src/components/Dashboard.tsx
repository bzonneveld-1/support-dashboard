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

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  // Only count calls/chatbot from evening rows (daily totals)
  const totalCalls = days.reduce(
    (sum, d) => sum + (d.evening?.total_calls ?? 0), 0,
  );
  const totalChat = days.reduce(
    (sum, d) => sum + (d.evening?.total_chatbot_chats ?? 0), 0,
  );
  const totalEmails = days.reduce(
    (sum, d) => sum + (d.evening?.total_emails ?? 0), 0,
  );
  const totalWaMsgs = days.reduce(
    (sum, d) => sum + (d.evening?.total_wa_messages ?? 0), 0,
  );
  const allOpenValues = days
    .flatMap(d => [d.morning?.all_open_tickets, d.evening?.all_open_tickets])
    .filter((v): v is number => v != null);
  const avgOpen = allOpenValues.length
    ? (allOpenValues.reduce((a, b) => a + b, 0) / allOpenValues.length).toFixed(1)
    : '—';

  if (loading && !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-lg text-[#8E8E93] animate-pulse">Loading...</div>
      </div>
    );
  }

  const isCurrentWeek = weekParam === 'current' || (data && toWeekParam(data.week) === toWeekParam(getTodayStr()));

  return (
    <div className="h-screen flex flex-col p-5 lg:p-8 bg-[#F2F2F7]">
      <NavHeader
        rightContent={
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8E8E93]">
              Week {weekInfo?.week} &middot; {data && formatDateRange(data.week, data.weekEnd)}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => data && setWeekParam(navigateWeek(data.week, -1))}
                className="w-7 h-7 rounded-md hover:bg-[#F0F0F2] flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] transition-colors text-xs"
              >
                &#9664;
              </button>
              {!isCurrentWeek && (
                <button
                  onClick={() => setWeekParam('current')}
                  className="h-7 px-2.5 rounded-md bg-[#007AFF] text-white text-[11px] font-medium hover:bg-[#0071E3] transition-colors"
                >
                  Today
                </button>
              )}
              <button
                onClick={() => data && setWeekParam(navigateWeek(data.week, 1))}
                className="w-7 h-7 rounded-md hover:bg-[#F0F0F2] flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] transition-colors text-xs"
              >
                &#9654;
              </button>
            </div>
          </div>
        }
      />

      {/* Table card */}
      <div className="flex-1 overflow-hidden min-h-0 bg-white rounded-2xl shadow-sm">
        <table className="w-full h-full border-collapse text-center">
          <thead className="sticky top-0 z-10">
            {/* Row 1: Group labels */}
            <tr className="bg-[#1D1D1F]">
              <th rowSpan={3} className="px-5 py-2 text-left text-[11px] font-medium text-[#B3B3B5] uppercase tracking-wider w-[120px] border-r border-[#343436]">
                Day
              </th>
              <th colSpan={4} className="px-4 pt-2.5 pb-0.5 text-[11px] font-semibold text-[#B3B3B5] uppercase tracking-[0.12em] border-r border-[#343436]">
                Daily Totals
              </th>
              <th colSpan={10} className="px-4 pt-2.5 pb-0.5 text-[11px] font-semibold text-[#B3B3B5] uppercase tracking-[0.12em]">
                Ticket Snapshots
              </th>
            </tr>
            {/* Row 2: Column names */}
            <tr className="bg-[#1D1D1F]">
              <th rowSpan={2} className="px-4 py-1 text-[11px] font-medium text-[#B3B3B5] uppercase tracking-wider">Calls</th>
              <th rowSpan={2} className="px-4 py-1 text-[11px] font-medium text-[#B3B3B5] uppercase tracking-wider">Chatbot</th>
              <th rowSpan={2} className="px-4 py-1 text-[11px] font-medium text-[#B3B3B5] uppercase tracking-wider">Emails</th>
              <th rowSpan={2} className="px-4 py-1 text-[11px] font-medium text-[#B3B3B5] uppercase tracking-wider border-r border-[#343436]">WA Msgs</th>
              {TICKET_METRICS.map((m, i) => (
                <th
                  key={m.key}
                  colSpan={2}
                  className={`px-3 py-1 text-[11px] font-medium text-white uppercase tracking-wider ${i > 0 ? 'border-l border-[#2B2B2D]' : ''}`}
                >
                  {m.label}
                </th>
              ))}
            </tr>
            {/* Row 3: 08/18 sub-headers */}
            <tr className="bg-[#1D1D1F]">
              {TICKET_METRICS.map((m, i) => (
                <Fragment key={m.key}>
                  <th className={`px-2 pb-1.5 text-[10px] font-medium text-[#9D9DA0] ${i > 0 ? 'border-l border-[#2B2B2D]' : ''}`}>
                    08
                  </th>
                  <th className="px-2 pb-1.5 text-[10px] font-medium text-[#9D9DA0]">
                    18
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, dayIdx) => {
              // Only show calls/chatbot from evening row (daily totals from midnight run)
              const dailyCalls = day.evening?.total_calls ?? null;
              const dailyChat = day.evening?.total_chatbot_chats ?? null;
              const dailyEmails = day.evening?.total_emails ?? null;
              const dailyWaMsgs = day.evening?.total_wa_messages ?? null;
              return (
                <tr
                  key={day.date}
                  className={`
                    border-b border-[#E5E5EA] transition-colors
                    ${day.isToday ? 'bg-[#F5F9FF]' : dayIdx % 2 === 1 ? 'bg-[#FAFAFA]' : ''}
                    ${day.isFuture ? 'opacity-20' : ''}
                  `}
                  style={{ height: `${100 / 7}%` }}
                >
                  {/* Day name */}
                  <td className="px-5 py-2.5 text-left relative border-r border-[#E5E5EA]">
                    {day.isToday && (
                      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#007AFF]" />
                    )}
                    <span className={`text-[13px] font-medium ${day.isToday ? 'text-[#007AFF]' : 'text-[#1C1C1E]'}`}>
                      {day.dayName}
                    </span>
                    {day.isToday && (
                      <span className="ml-1.5 text-[9px] font-medium text-[#66ADFF] uppercase tracking-widest">today</span>
                    )}
                  </td>

                  {/* Calls — today shows dash (collected after midnight) */}
                  <td className="px-4 py-2.5 tabular-nums">
                    {day.isFuture || day.isToday ? (
                      <span className="text-[#C7C7CC]">—</span>
                    ) : dailyCalls != null ? (
                      <span className="text-xl font-medium text-[#1C1C1E]">{dailyCalls}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Chatbot */}
                  <td className="px-4 py-2.5 tabular-nums">
                    {day.isFuture || day.isToday ? (
                      <span className="text-[#C7C7CC]">—</span>
                    ) : dailyChat != null ? (
                      <span className="text-xl font-medium text-[#1C1C1E]">{dailyChat}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Emails */}
                  <td className="px-4 py-2.5 tabular-nums">
                    {day.isFuture || day.isToday ? (
                      <span className="text-[#C7C7CC]">—</span>
                    ) : dailyEmails != null ? (
                      <span className="text-xl font-medium text-[#1C1C1E]">{dailyEmails}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* WA Messages */}
                  <td className="px-4 py-2.5 tabular-nums border-r-2 border-[#E5E5EA]">
                    {day.isFuture || day.isToday ? (
                      <span className="text-[#C7C7CC]">—</span>
                    ) : dailyWaMsgs != null ? (
                      <span className="text-xl font-medium text-[#1C1C1E]">{dailyWaMsgs}</span>
                    ) : (
                      <MissingCell
                        backfilling={backfilling === `${day.date}-18:00`}
                        onBackfill={() => handleBackfill(day.date, '18:00')}
                      />
                    )}
                  </td>

                  {/* Ticket metrics: 08 + 18 per group */}
                  {TICKET_METRICS.map((metric, groupIdx) => {
                    const morningVal = day.morning?.[metric.key] ?? null;
                    const eveningVal = day.evening?.[metric.key] ?? null;
                    const delta = formatDelta(morningVal, eveningVal);
                    const deltaColor = getDeltaColor(morningVal, eveningVal);
                    const isFirstGroup = groupIdx === 0;

                    return (
                      <Fragment key={metric.key}>
                        {/* 08:00 — ticket snapshots can't be backfilled */}
                        <td className={`py-2.5 tabular-nums ${isFirstGroup ? 'pl-5 pr-3' : 'px-3 border-l border-[#F2F2F7]'}`}>
                          {day.isFuture ? (
                            <span className="text-[#C7C7CC]">—</span>
                          ) : morningVal != null ? (
                            <span className="text-xl font-medium text-[#1C1C1E]">{morningVal}</span>
                          ) : (
                            <span className="text-[#C7C7CC]">—</span>
                          )}
                        </td>

                        {/* 18:00 */}
                        <td className="px-3 py-2.5 tabular-nums">
                          {day.isFuture ? (
                            <span className="text-[#C7C7CC]">—</span>
                          ) : eveningVal != null ? (
                            <span className="inline-flex items-baseline gap-1">
                              <span className={`text-xl font-medium ${deltaColor || 'text-[#1C1C1E]'}`}>
                                {eveningVal}
                              </span>
                              {delta && (
                                <span className={`text-[10px] font-medium ${deltaColor}`}>
                                  {delta}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[#C7C7CC]">—</span>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Summary */}
          <tfoot>
            <tr className="border-t-2 border-[#E5E5EA]">
              <td className="px-5 py-2.5 text-left border-r border-[#E5E5EA]">
                <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wider">Week Total</span>
              </td>
              <td className="py-2.5 text-[#8E8E93] text-xs border-r-2 border-[#E5E5EA]" colSpan={4}>
                <div className="flex items-center justify-center gap-4">
                  <span>Calls <strong className="text-[#1C1C1E] text-sm font-medium">{totalCalls}</strong></span>
                  <span className="text-[#E5E5EA]">|</span>
                  <span>Chatbot <strong className="text-[#1C1C1E] text-sm font-medium">{totalChat}</strong></span>
                  <span className="text-[#E5E5EA]">|</span>
                  <span>Emails <strong className="text-[#1C1C1E] text-sm font-medium">{totalEmails}</strong></span>
                  <span className="text-[#E5E5EA]">|</span>
                  <span>WA Msgs <strong className="text-[#1C1C1E] text-sm font-medium">{totalWaMsgs}</strong></span>
                </div>
              </td>
              <td className="py-2.5 text-[#8E8E93] text-xs" colSpan={10}>
                <div className="flex items-center justify-center">
                  <span>Avg. All Open <strong className="text-[#1C1C1E] text-sm font-medium">{avgOpen}</strong></span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
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
      title="Click to fetch data"
    >
      {backfilling ? (
        <span className="text-[#FF9500] animate-pulse text-xs">fetching...</span>
      ) : (
        <span className="text-[#C7C7CC]">—</span>
      )}
    </button>
  );
}
