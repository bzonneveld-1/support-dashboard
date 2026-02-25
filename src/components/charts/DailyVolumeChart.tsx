'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from 'recharts';

interface MetricsRow {
  metric_date: string;
  time_slot: string;
  calls_answered: number | null;
  total_chatbot_chats: number | null;
  total_emails: number | null;
  total_wa_messages: number | null;
}

const formatDate = (d: string) => {
  const date = new Date(d + 'T12:00:00Z');
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
};

export default function DailyVolumeChart({ metrics }: { metrics: MetricsRow[] }) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [isTv, setIsTv] = useState(false);
  useEffect(() => { setIsTv(document.documentElement.hasAttribute('data-tv')); }, []);
  const tickSize = isTv ? 18 : 11;
  const legendSize = isTv ? 16 : 12;

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
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const yMax = useMemo(() => {
    const maxTotal = Math.max(...data.map(d => d.Calls + d.Chatbot + d.Emails + d['WA Msgs']), 0);
    return Math.ceil(maxTotal * 1.15);
  }, [data]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTick = (props: any) => {
    const { x, y, payload } = props;
    const label = formatDate(payload.value);
    const isToday = payload.value === today;
    const r = isTv ? 20 : 15;
    if (isToday) {
      return (
        <g transform={`translate(${x},${y})`}>
          <circle cx={0} cy={tickSize * 0.7} r={r} fill="none" stroke="#8E8E93" strokeWidth={1.5} opacity={0.45} />
          <text x={0} y={tickSize * 1.1} textAnchor="middle" fontSize={tickSize} fill="#8E8E93">{label}</text>
        </g>
      );
    }
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={tickSize * 1.1} textAnchor="middle" fontSize={tickSize} fill="#8E8E93">{label}</text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
        <XAxis dataKey="date" tick={renderTick} />
        <YAxis domain={[0, yMax]} tick={{ fontSize: tickSize, fill: '#8E8E93' }} />
        <Tooltip labelFormatter={(label) => formatDate(String(label))} />
        <Legend wrapperStyle={{ fontSize: legendSize }} />
        <Bar dataKey="Calls" stackId="a" fill="#007AFF" />
        <Bar dataKey="Chatbot" stackId="a" fill="#8E8E93" />
        <Bar dataKey="Emails" stackId="a" fill="#FF6620" />
        <Bar dataKey="WA Msgs" stackId="a" fill="#34C759" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
