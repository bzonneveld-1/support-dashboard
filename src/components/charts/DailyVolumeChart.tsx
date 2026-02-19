'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  total_calls: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
}

export default function DailyVolumeChart({ metrics }: { metrics: MetricsRow[] }) {
  const data = useMemo(() => {
    return metrics
      .filter(m => m.time_slot === '18:00')
      .map(m => ({
        date: m.metric_date.split('T')[0],
        Calls: m.total_calls ?? 0,
        Chatbot: m.total_chatbot_chats ?? 0,
        Emails: m.total_emails ?? 0,
        'WA Msgs': m.total_wa_messages ?? 0,
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
        <Legend />
        <Bar dataKey="Calls" stackId="a" fill="#1C1C1E" />
        <Bar dataKey="Chatbot" stackId="a" fill="#8E8E93" />
        <Bar dataKey="Emails" stackId="a" fill="#FF9500" />
        <Bar dataKey="WA Msgs" stackId="a" fill="#34C759" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
