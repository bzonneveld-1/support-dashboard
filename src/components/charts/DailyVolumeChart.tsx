'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, Cell,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  calls_answered: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
}

export default function DailyVolumeChart({ metrics }: { metrics: MetricsRow[] }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const data = useMemo(() => {
    const byDate = new Map<string, { Calls: number; Chatbot: number; Emails: number; 'WA Msgs': number }>();
    for (const m of metrics) {
      if (m.time_slot !== 'latest' && m.time_slot !== '18:00') continue;
      const date = m.metric_date.split('T')[0];
      const existing = byDate.get(date);
      if (!existing || m.time_slot === 'latest') {
        byDate.set(date, {
          Calls: m.calls_answered ?? 0,
          Chatbot: m.total_chatbot_chats ?? 0,
          Emails: m.total_emails ?? 0,
          'WA Msgs': m.total_wa_messages ?? 0,
        });
      }
    }
    return Array.from(byDate.entries())
      .map(([date, vals]) => ({ date, ...vals, isToday: date === today }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics, today]);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T12:00:00Z');
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  const yMax = useMemo(() => {
    const maxTotal = Math.max(...data.map(d => d.Calls + d.Chatbot + d.Emails + d['WA Msgs']), 0);
    return Math.ceil(maxTotal * 1.15);
  }, [data]);

  const todayCells = data.map((entry, i) => (
    <Cell key={i} fillOpacity={entry.isToday ? 0.45 : 1} />
  ));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <YAxis domain={[0, yMax]} tick={{ fontSize: 11, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Legend />
        <Bar dataKey="Calls" stackId="a" fill="#1C1C1E">{todayCells}</Bar>
        <Bar dataKey="Chatbot" stackId="a" fill="#8E8E93">{todayCells}</Bar>
        <Bar dataKey="Emails" stackId="a" fill="#FF6620">{todayCells}</Bar>
        <Bar dataKey="WA Msgs" stackId="a" fill="#34C759" radius={[4, 4, 0, 0]}>{todayCells}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
