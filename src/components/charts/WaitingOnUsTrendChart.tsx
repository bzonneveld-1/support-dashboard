'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  waiting_on_us: number | null;
  whatsapp_waiting_on_us: number | null;
}

export default function WaitingOnUsTrendChart({ metrics }: { metrics: MetricsRow[] }) {
  const data = useMemo(() => {
    return metrics
      .filter(m => m.time_slot === '18:00')
      .map(m => ({
        date: m.metric_date.split('T')[0],
        'Tickets WoU': m.waiting_on_us,
        'WA WoU': m.whatsapp_waiting_on_us,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Legend />
        <Line
          type="monotone" dataKey="Tickets WoU" name="Tickets WoU"
          stroke="#1C1C1E" dot={false} strokeWidth={2} connectNulls
        />
        <Line
          type="monotone" dataKey="WA WoU" name="WA WoU"
          stroke="#FF9500" dot={false} strokeWidth={2} connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
