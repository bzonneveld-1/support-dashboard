'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  calls_answered: number | null;
  calls_missed: number | null;
}

export default function DailyResolutionChart({ metrics }: { metrics: MetricsRow[] }) {
  const data = useMemo(() => {
    const byDate = new Map<string, { answered: number; missed: number }>();
    for (const m of metrics) {
      if (m.time_slot !== 'latest' && m.time_slot !== '18:00') continue;
      const date = m.metric_date.split('T')[0];
      const existing = byDate.get(date);
      // Prefer latest, fallback to 18:00
      if (!existing || m.time_slot === 'latest') {
        const answered = m.calls_answered ?? 0;
        const missed = m.calls_missed ?? 0;
        if (answered > 0 || missed > 0) {
          byDate.set(date, { answered, missed });
        }
      }
    }
    return Array.from(byDate.entries())
      .map(([date, { answered, missed }]) => ({ date, answered, missed }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  const yMax = useMemo(() => {
    const maxTotal = Math.max(...data.map(d => d.answered + d.missed), 0);
    return Math.ceil(maxTotal * 1.15);
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <YAxis domain={[0, yMax]} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Legend />
        <Bar dataKey="answered" name="Answered" stackId="calls" fill="#34C759" radius={[0, 0, 0, 0]} />
        <Bar dataKey="missed" name="Missed" stackId="calls" fill="#FF3B30" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
