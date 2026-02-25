'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  all_open_tickets: number | null;
}

export default function AllOpenTrendChart({ metrics }: { metrics: MetricsRow[] }) {
  const data = useMemo(() => {
    const byDate = new Map<string, { date: string; morning: number | null; evening: number | null }>();
    for (const m of metrics) {
      const date = m.metric_date.split('T')[0];
      if (!byDate.has(date)) byDate.set(date, { date, morning: null, evening: null });
      const entry = byDate.get(date)!;
      if (m.time_slot === '08:00') entry.morning = m.all_open_tickets;
      if (m.time_slot === '18:00') entry.evening = m.all_open_tickets;
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  const yDomain = useMemo(() => {
    const vals = data.flatMap(d => [d.morning, d.evening]).filter((v): v is number => v != null);
    if (vals.length === 0) return [0, 100] as const;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const padding = Math.max(Math.ceil((max - min) * 0.15), 5);
    return [Math.max(0, min - padding), max + padding] as const;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <YAxis domain={[yDomain[0], yDomain[1]]} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Legend />
        <Line
          type="monotone" dataKey="morning" name="08:00"
          stroke="#1C1C1E" strokeDasharray="5 5" dot={false} strokeWidth={2} connectNulls
        />
        <Line
          type="monotone" dataKey="evening" name="18:00"
          stroke="#34C759" dot={false} strokeWidth={2} connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
