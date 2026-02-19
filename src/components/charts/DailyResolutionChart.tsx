'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, ReferenceLine,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  all_open_tickets: number | null;
}

export default function DailyResolutionChart({ metrics }: { metrics: MetricsRow[] }) {
  const data = useMemo(() => {
    const byDate = new Map<string, { morning: number | null; evening: number | null }>();
    for (const m of metrics) {
      const date = m.metric_date.split('T')[0];
      if (!byDate.has(date)) byDate.set(date, { morning: null, evening: null });
      const entry = byDate.get(date)!;
      if (m.time_slot === '08:00') entry.morning = m.all_open_tickets;
      if (m.time_slot === '18:00') entry.evening = m.all_open_tickets;
    }
    return Array.from(byDate.entries())
      .map(([date, { morning, evening }]) => ({
        date,
        resolved: morning != null && evening != null ? morning - evening : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <ReferenceLine y={0} stroke="#8E8E93" />
        <Bar dataKey="resolved" name="Net Resolved" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.resolved >= 0 ? '#34C759' : '#FF3B30'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
