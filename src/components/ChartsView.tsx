'use client';

import { useState, useEffect, useCallback } from 'react';
import NavHeader from './NavHeader';
import { useDataVersion } from '@/hooks/useDataVersion';
import AllOpenTrendChart from './charts/AllOpenTrendChart';
import DailyVolumeChart from './charts/DailyVolumeChart';
import DailyResolutionChart from './charts/DailyResolutionChart';
import SubscriptionsChart from './charts/SubscriptionsChart';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  all_open_tickets: number | null;
  unassigned_tickets: number | null;
  whatsapp_all_open: number | null;
  whatsapp_waiting_on_us: number | null;
  waiting_on_us: number | null;
  total_calls: number | null;
  calls_answered: number | null;
  calls_missed: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
  subscriptions_active: number | null;
}

const REFRESH_MS = 5 * 60 * 1000;

export default function ChartsView() {
  const [weeks, setWeeks] = useState(1);
  const [metrics, setMetrics] = useState<MetricsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTv, setIsTv] = useState(false);

  useEffect(() => {
    setIsTv(document.documentElement.hasAttribute('data-tv'));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/metrics?weeks=${weeks}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setMetrics(json.metrics);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const timer = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  useDataVersion(fetchData);

  const periodSelector = (
    <div className="flex gap-1">
      {[1, 2, 4, 8].map(w => (
        <button
          key={w}
          onClick={() => setWeeks(w)}
          style={{ fontSize: isTv ? 24 : 11, height: isTv ? 40 : 28, padding: isTv ? '0 12px' : '0 10px' }}
          className={`rounded-md font-medium transition-colors ${
            weeks === w
              ? 'bg-[#007AFF] text-white'
              : 'text-[#8E8E93] hover:bg-[var(--dash-surface)]/80 hover:text-[var(--dash-text)]'
          }`}
        >
          {w}w
        </button>
      ))}
    </div>
  );

  return (
    <div className="dash-outer h-screen flex flex-col p-5 lg:p-8 bg-[var(--dash-bg)]">
      <NavHeader rightContent={periodSelector} />
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg text-[#8E8E93] animate-pulse">Loading...</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="All Open Trend" isTv={isTv}>
            <AllOpenTrendChart metrics={metrics} />
          </ChartCard>
          <ChartCard title="Daily Volume by Channel" isTv={isTv}>
            <DailyVolumeChart metrics={metrics} />
          </ChartCard>
          <ChartCard title="Calls per Day" isTv={isTv}>
            <DailyResolutionChart metrics={metrics} />
          </ChartCard>
          <ChartCard title="Subscriptions Total" isTv={isTv}>
            <SubscriptionsChart metrics={metrics} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children, isTv }: { title: string; children: React.ReactNode; isTv: boolean }) {
  return (
    <div className="bg-[var(--dash-surface)] rounded-2xl shadow-sm p-5 flex flex-col">
      <h2 style={{ fontSize: isTv ? 28 : 13 }} className="font-semibold text-[var(--dash-text)] mb-3">{title}</h2>
      <div className="flex-1 min-h-[250px]">
        {children}
      </div>
    </div>
  );
}
