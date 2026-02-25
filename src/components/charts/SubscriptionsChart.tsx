'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  subscriptions_active: number | null;
}

export default function SubscriptionsChart({ metrics }: { metrics: MetricsRow[] }) {
  const data = useMemo(() => {
    // Use latest time_slot per day (that's where subs data lives)
    const byDate = new Map<string, number>();
    for (const m of metrics) {
      if (m.subscriptions_active == null) continue;
      const date = m.metric_date.split('T')[0];
      // Keep the highest value per day (latest snapshot)
      const existing = byDate.get(date);
      if (existing == null || m.subscriptions_active > existing) {
        byDate.set(date, m.subscriptions_active);
      }
    }
    return Array.from(byDate.entries())
      .map(([date, subs]) => ({ date, subs }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  // Calculate Y-axis domain to zoom in on changes
  const values = data.map(d => d.subs);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(Math.ceil((max - min) * 0.2), 5);
  const yMin = Math.max(0, min - padding);
  const yMax = max + padding;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Line
          type="monotone" dataKey="subs" name="Subs Total"
          stroke="#AF52DE" dot={{ r: 3, fill: '#AF52DE' }} strokeWidth={2} connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
