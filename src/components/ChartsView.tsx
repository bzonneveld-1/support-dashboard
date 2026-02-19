'use client';

import { useState, useEffect, useCallback } from 'react';
import NavHeader from './NavHeader';
import AllOpenTrendChart from './charts/AllOpenTrendChart';
import DailyVolumeChart from './charts/DailyVolumeChart';
import DailyResolutionChart from './charts/DailyResolutionChart';
import WaitingOnUsTrendChart from './charts/WaitingOnUsTrendChart';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  all_open_tickets: number | null;
  unassigned_tickets: number | null;
  whatsapp_all_open: number | null;
  whatsapp_waiting_on_us: number | null;
  waiting_on_us: number | null;
  total_calls: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
}

const REFRESH_MS = 5 * 60 * 1000;

export default function ChartsView() {
  const [weeks, setWeeks] = useState(4);
  const [metrics, setMetrics] = useState<MetricsRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const periodSelector = (
    <div className="flex gap-1">
      {[1, 2, 4, 8].map(w => (
        <button
          key={w}
          onClick={() => setWeeks(w)}
          className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
            weeks === w
              ? 'bg-[#007AFF] text-white'
              : 'text-[#8E8E93] hover:bg-white/80 hover:text-[#1C1C1E]'
          }`}
        >
          {w}w
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen flex flex-col p-5 lg:p-8 bg-[#F2F2F7]">
      <NavHeader rightContent={periodSelector} />
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-lg text-[#8E8E93] animate-pulse">Loading...</div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="All Open Trend">
            <AllOpenTrendChart metrics={metrics} />
          </ChartCard>
          <ChartCard title="Daily Volume by Channel">
            <DailyVolumeChart metrics={metrics} />
          </ChartCard>
          <ChartCard title="Daily Resolution">
            <DailyResolutionChart metrics={metrics} />
          </ChartCard>
          <ChartCard title="Waiting on Us Trend">
            <WaitingOnUsTrendChart metrics={metrics} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col">
      <h2 className="text-[13px] font-semibold text-[#1C1C1E] mb-3">{title}</h2>
      <div className="flex-1 min-h-[250px]">
        {children}
      </div>
    </div>
  );
}
