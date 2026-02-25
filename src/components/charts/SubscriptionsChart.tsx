'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [isTv, setIsTv] = useState(false);
  useEffect(() => { setIsTv(document.documentElement.hasAttribute('data-tv')); }, []);
  const tickSize = isTv ? 18 : 11;

  const data = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const m of metrics) {
      if (m.subscriptions_active == null) continue;
      const date = m.metric_date.split('T')[0];
      const existing = byDate.get(date);
      if (existing == null || m.subscriptions_active > existing) {
        byDate.set(date, m.subscriptions_active);
      }
    }
    return Array.from(byDate.entries())
      .map(([date, subs]) => ({ date, subs, isToday: date === today }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics, today]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  const values = data.map(d => d.subs);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(Math.ceil((max - min) * 0.2), 5);
  const yMin = Math.max(0, min - padding);
  const yMax = max + padding;

  const dotR = isTv ? 6 : 3;
  const todayR = isTv ? 8 : 4;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    if (payload.isToday) {
      return <circle cx={cx} cy={cy} r={todayR} fill="none" stroke="#AF52DE" strokeWidth={2} opacity={0.6} />;
    }
    return <circle cx={cx} cy={cy} r={dotR} fill="#AF52DE" />;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: tickSize, fill: '#8E8E93' }} />
        <YAxis domain={[yMin, yMax]} tick={{ fontSize: tickSize, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Line
          type="monotone" dataKey="subs" name="Subs Total"
          stroke="#AF52DE" dot={renderDot} strokeWidth={2} connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
