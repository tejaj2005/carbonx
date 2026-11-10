import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { label, number, type Item } from './api';
export function UsageTrend({
  readings,
  synthetic = false,
}: {
  readings: Item[];
  synthetic?: boolean;
}) {
  const [selected, setSelected] = useState('');
  const groups = useMemo(() => {
    const result = new Map<string, { key: string; title: string; unit: string; points: Item[] }>();
    for (const r of readings) {
      const key = JSON.stringify([r.metric, r.facility_id || r.scope || '', r.unit]);
      if (!result.has(key))
        result.set(key, {
          key,
          title: label(r.metric) + ' · ' + (r.facility_name || r.scope || 'Facility'),
          unit: r.unit,
          points: [],
        });
      const time = Date.parse(r.recorded_at || r.recordedAt);
      if (Number.isFinite(time) && Number.isFinite(Number(r.value)))
        result.get(key)!.points.push({ time, value: Number(r.value) });
    }
    return [...result.values()]
      .filter((g) => g.points.length >= 2)
      .map((g) => ({
        ...g,
        points: g.points.sort((a, b) => a.time - b.time),
      }));
  }, [readings]);
  const group = groups.find((g) => g.key === selected) || groups[0];
  if (!group || group.points.length < 2) return null;
  const month = (v: number) =>
    new Date(v).toLocaleDateString('en-IN', {
      month: 'short',
      year: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  return (
    <section className="usage-trend">
      <div className="row-between">
        <h3>{synthetic ? 'Monthly usage · demo history' : 'Usage over time'}</h3>
        <select
          aria-label="Usage trend metric"
          value={group.key}
          onChange={(e) => setSelected(e.target.value)}
        >
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.title} ({g.unit})
            </option>
          ))}
        </select>
      </div>
      <p className="fine-print">
        {synthetic ? 'Synthetic monthly period totals. ' : 'Submitted observations. '}One metric and
        facility per series · {group.unit} · period end in IST.
      </p>
      <div style={{ width: '100%', height: 230 }}>
        <ResponsiveContainer>
          <LineChart data={group.points} margin={{ top: 16, right: 20, bottom: 20, left: 18 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={month}
              tick={{ fontSize: 11 }}
              label={{ value: 'Period ending (IST)', position: 'insideBottom', offset: -15 }}
            />
            <YAxis
              width={65}
              tick={{ fontSize: 11 }}
              label={{ value: group.unit, angle: -90, position: 'insideLeft', dx: -10 }}
            />
            <Tooltip
              labelFormatter={(v) =>
                new Date(Number(v)).toLocaleDateString('en-IN', {
                  dateStyle: 'medium',
                  timeZone: 'Asia/Kolkata',
                })
              }
              formatter={(v) => [number(Number(v), 2) + ' ' + group.unit, 'Period total']}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke="#287558"
              strokeWidth={3}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
