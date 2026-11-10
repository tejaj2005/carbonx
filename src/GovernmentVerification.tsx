import React, { useState, useEffect, useRef } from 'react';
import { SatelliteVerification } from './SatelliteView';
import { useWorkspace } from './context';
import { api, mutate, date, number, type Item } from './api';
import { Panel, Badge } from './components';
export function GovernmentVerification() {
  const { data, toast } = useWorkspace(),
    facilities = data.monitoring.facilities || [],
    [id, setId] = useState(''),
    [contexts, setContexts] = useState<Item[]>([]),
    [busy, setBusy] = useState(false);
  const facility = facilities.find((f: Item) => f.id === (id || facilities[0]?.id));
  const selectedRef = useRef(facility?.id);
  selectedRef.current = facility?.id;
  async function load() {
    if (!facility) return;
    try {
      const requested = facility.id;
      const result = await api('/government/facilities/' + requested + '/context');
      if (selectedRef.current === requested) setContexts(result);
    } catch (e) {
      toast((e as Error).message);
    }
  }
  useEffect(() => {
    setContexts([]);
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [facility?.id]);
  async function refresh() {
    if (!facility) return;
    setBusy(true);
    try {
      await mutate('/government/facilities/' + facility.id + '/context');
      toast('Site context request queued. Results refresh automatically.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const atmosphere = contexts.find((c) => c.kind === 'atmosphere');
  return (
    <>
      <Panel title="Government site verification">
        <p className="fine-print">
          Authorized facility context. Coordinates are sent to Open-Meteo when you request a
          refresh; only explicitly published summaries appear publicly.
        </p>
        {facilities.length ? (
          <>
            <select
              aria-label="Government verification facility"
              value={facility?.id || ''}
              onChange={(e) => setId(e.target.value)}
            >
              {facilities.map((f: Item) => (
                <option value={f.id} key={f.id}>
                  {f.company_name} · {f.name}
                </option>
              ))}
            </select>
            <button
              className="button secondary"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() => void refresh()}
            >
              {busy ? 'Queuing…' : 'Refresh site air & weather'}
            </button>
            {atmosphere && (
              <div className="environment-cards">
                {atmosphere.payload.sources?.map((s: Item) => (
                  <div className="environment-card" key={s.kind}>
                    <b>{s.kind === 'weather' ? 'Temperature (°C)' : 'PM₂.₅ (µg/m³)'}</b>
                    <strong>
                      {s.status === 'available'
                        ? number(
                            s.kind === 'weather'
                              ? s.data?.current?.temperature_2m
                              : s.data?.current?.pm2_5,
                            1,
                          )
                        : '—'}
                    </strong>
                    <Badge value={s.status} />
                    <small>
                      Provider time ({s.data?.timezone || 'UTC'}):{' '}
                      {s.data?.current?.time || 'Unavailable'}
                    </small>
                  </div>
                ))}
                <p className="chart-note">
                  {atmosphere.payload.interpretation || atmosphere.payload.error} · Retrieved{' '}
                  {date(atmosphere.created_at)}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="muted">No facilities have been registered in this authority’s scope.</p>
        )}
      </Panel>
      <SatelliteVerification facility={facility} publicView />
    </>
  );
}
