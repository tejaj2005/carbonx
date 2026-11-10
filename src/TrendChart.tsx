import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { type Item, number } from './api';
export function AirTrend({ points = [] }: { points?: Item[] }) {
  const data = points.map((p) => ({ ...p, time: Date.parse(p.time), pm25: p.pm25 })),
    time = (value: number) =>
      new Date(value).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
  return (
    <section className="air-trend">
      <h3>PM₂.₅ performance history</h3>
      <p className="fine-print">
        Hourly regional model estimates · µg/m³ · Time in IST. Source: Open-Meteo / CAMS.
      </p>
      {data.filter((p) => Number.isFinite(p.pm25)).length >= 2 ? (
        <div style={{ height: 230, width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 16, right: 16, left: 20, bottom: 22 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                dataKey="time"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={time}
                tick={{ fontSize: 10 }}
                label={{ value: 'Observation time (IST)', position: 'insideBottom', offset: -16 }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                width={55}
                label={{ value: 'PM₂.₅ (µg/m³)', angle: -90, position: 'insideLeft', dx: -12 }}
              />
              <Tooltip
                labelFormatter={(v) =>
                  new Date(Number(v)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
                }
                formatter={(v) => [number(Number(v), 1) + ' µg/m³', 'PM₂.₅ model']}
              />
              <Line
                dataKey="pm25"
                stroke="#24694f"
                dot={false}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted">History appears after the next successful provider fetch.</p>
      )}
    </section>
  );
}
