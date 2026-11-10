import React, { useState } from 'react';
import { SatelliteScene } from '../VisualJourney';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Search,
  ArrowRight,
  BookOpen,
  Database,
  Plus,
  Upload,
  Trash2,
  MapPin,
  CloudSun,
  Satellite,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { api, mutate, label, number, date, type Item } from '../api';
import { useWorkspace } from '../context';
import { Heading, Panel, Empty, Field, Modal, SourceLink, Badge, Jobs } from '../components';
const metrics = [
  'water_consumption',
  'water_withdrawal',
  'water_recycled',
  'energy_consumption',
  'energy_generated',
  'emissions',
  'emissions_scope1',
  'emissions_scope2',
  'emissions_scope3',
  'waste_generated',
  'waste_recycled',
  'renewable_share',
  'land_area',
];
export function Evidence() {
  const { data, toast } = useWorkspace();
  const [query, setQuery] = useState(''),
    [report, setReport] = useState(''),
    [answer, setAnswer] = useState(false),
    [result, setResult] = useState<Item | null>(null),
    [busy, setBusy] = useState(false);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(await mutate('/retrieval/search', { query, reportId: report || null, answer }));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="EVIDENCE EXPLORER"
        title="Ask the reports. Inspect the evidence."
        description="Search only the passages in your company workspace. Source references stay attached to every result."
      />
      <Panel title="Find supporting passages">
        <form onSubmit={search} className="evidence-search">
          <div className="query-box">
            <Search size={21} />
            <input
              required
              minLength={2}
              maxLength={1000}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search report evidence"
              placeholder="How did water consumption change between reporting years?"
            />
            <button className="button primary" disabled={busy}>
              {busy ? 'Searching…' : 'Search'}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="search-options">
            <select
              aria-label="Limit search to a report"
              value={report}
              onChange={(e) => setReport(e.target.value)}
            >
              <option value="">All company reports</option>
              {data.reports.map((r: Item) => (
                <option value={r.id} key={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={answer}
                disabled={!data.settings.providers.hostedAI?.configured}
                onChange={(e) => setAnswer(e.target.checked)}
              />
              Include a grounded AI answer
            </label>
            <span className="muted">
              {data.settings.providers.hostedAI?.embeddingsConfigured
                ? 'Hybrid retrieval available'
                : 'Lexical retrieval active'}
            </span>
          </div>
        </form>
      </Panel>
      {result ? (
        <>
          <div className="result-summary">
            {result.passages.length} passages retrieved · {label(result.mode)} retrieval
          </div>
          {result.answer && (
            <Panel title="Grounded answer">
              <p className="answer-text">{result.answer.answer}</p>
              <div className="citation-chips">
                {result.answer.citations.map((id: string, i: number) => (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      document
                        .getElementById('passage-' + id)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                    key={id}
                  >
                    Source {i + 1}
                  </button>
                ))}
              </div>
            </Panel>
          )}
          <div className="passage-list">
            {result.passages.map((p: Item, i: number) => (
              <article className="panel passage" key={p.id} id={'passage-' + p.id}>
                <div className="passage-heading">
                  <span className="passage-number">{i + 1}</span>
                  <div>
                    <strong>{p.report_name}</strong>
                    <small>
                      Source {p.page_number} · passage {p.number}
                    </small>
                  </div>
                  <SourceLink reportId={p.report_id} page={p.page_number} />
                </div>
                <blockquote>{p.text}</blockquote>
              </article>
            ))}
          </div>
          {!result.passages.length && (
            <Empty title="No supporting passage found">
              Try a specific metric, reporting year or phrase from an uploaded report.
            </Empty>
          )}
        </>
      ) : (
        <div className="explorer-empty">
          <BookOpen size={36} />
          <h2>The answer is only as useful as its evidence.</h2>
          <p>
            Start with a metric, a claim or a question. Inspect the retrieved passages before
            interpreting a generated answer.
          </p>
          <div className="query-suggestions">
            {[
              'Water consumption reduction',
              'Renewable energy share',
              'Carbon emissions reporting boundary',
            ].map((q) => (
              <button key={q} onClick={() => setQuery(q)}>
                {q}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
function ObservationForm({ onClose }: { onClose: () => void }) {
  const { data, toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await mutate('/history', { ...values, facilityId: values.facilityId || null });
      toast('Historical observation saved. Claim comparisons were refreshed.');
      await refresh();
      onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a historical observation" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Metric">
          <select name="metric">
            {metrics.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Reported value">
            <input name="value" type="number" step="any" min={0} required />
          </Field>
          <Field label="Unit">
            <input name="unit" required placeholder="kL, m3, MWh, tCO2e…" />
          </Field>
        </div>
        <div className="two-fields">
          <Field label="Reporting year (ending)">
            <input name="year" type="number" min={1990} max={2100} defaultValue={2024} required />
          </Field>
          <Field label="Facility">
            <select name="facilityId">
              <option value="">Company-wide</option>
              {data.facilities.map((f: Item) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Reporting boundary">
          <input
            name="boundary"
            minLength={2}
            required
            placeholder="Must match the claim boundary"
          />
        </Field>
        <Field
          label="Source reference"
          hint="Name the report and page, meter record, or source system supporting this observation."
        >
          <textarea
            name="source"
            minLength={3}
            maxLength={500}
            required
            placeholder="FY2023 sustainability report, page 42"
          />
        </Field>
        <button className="button primary full" disabled={busy}>
          {busy ? 'Saving…' : 'Save observation'}
        </button>
      </form>
    </Modal>
  );
}
function CsvImport({ onClose }: { onClose: () => void }) {
  const { toast, refresh } = useWorkspace();
  const [csv, setCsv] = useState(
      'metric,value,unit,year,boundary,facilityId,source\nwater_consumption,1000,kL,2023,All company operations,,FY2023 report page 42',
    ),
    [preview, setPreview] = useState<Item | null>(null),
    [busy, setBusy] = useState(false);
  async function run(confirm = false) {
    setBusy(true);
    try {
      const result = await mutate('/history/import', { csv, confirm });
      if (confirm) {
        toast(result.count + ' historical observations imported.');
        await refresh();
        onClose();
      } else setPreview(result);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Import historical data" onClose={onClose} wide>
      <p className="modal-intro">
        Preview the CSV before committing it. Use exact facility IDs from Settings, or leave
        facilityId empty for a company-wide record. Existing records are never silently replaced.
      </p>
      <input
        type="file"
        accept=".csv"
        aria-label="Select historical CSV"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            setCsv(await file.text());
            setPreview(null);
          }
        }}
      />
      <textarea
        className="csv-editor"
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPreview(null);
        }}
        aria-label="Historical CSV"
      />
      {preview && (
        <div className="callout info">
          <b>{preview.count} validated rows</b>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>METRIC</th>
                  <th>VALUE</th>
                  <th>YEAR</th>
                  <th>BOUNDARY</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.slice(0, 10).map((r: Item, i: number) => (
                  <tr key={i}>
                    <td>{label(r.metric)}</td>
                    <td>
                      {r.value} {r.unit}
                    </td>
                    <td>{r.year}</td>
                    <td>{r.boundary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="button-row">
        <button className="button secondary" disabled={busy} onClick={() => void run(false)}>
          Validate & preview
        </button>
        <button
          className="button primary"
          disabled={busy || !preview}
          onClick={() => void run(true)}
        >
          Confirm import
        </button>
      </div>
    </Modal>
  );
}
function HistoricalChart({ observations }: { observations: Item[] }) {
  const [selected, setSelected] = useState('');
  const groups = new Map<string, Item>();
  for (const r of observations) {
    const key = JSON.stringify([
      r.metric,
      r.facility_id,
      r.boundary.trim().toLowerCase(),
      r.normalized_unit,
    ]);
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: label(r.metric) + ' · ' + (r.facility_name || 'Company-wide') + ' · ' + r.boundary,
        unit: r.normalized_unit,
        points: [],
      });
    groups.get(key)!.points.push({ year: r.year, value: r.normalized_value });
  }
  const group = groups.get(selected) || [...groups.values()][0];
  if (!group) return null;
  const points = group.points.sort((a: Item, b: Item) => a.year - b.year);
  return (
    <Panel
      title="Performance over time"
      action={
        <select
          aria-label="Historical chart series"
          style={{ maxWidth: 'min(420px, 100%)', minWidth: 0 }}
          value={group.key}
          onChange={(e) => setSelected(e.target.value)}
        >
          {[...groups.values()].map((g) => (
            <option key={g.key} value={g.key}>
              {g.title}
            </option>
          ))}
        </select>
      }
    >
      <p className="chart-note">
        {group.title} · {group.unit}. Each series uses one metric, facility, boundary and compatible
        unit.
      </p>
      {points.length >= 2 ? (
        <div style={{ height: 250, width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 20, right: 28, bottom: 5, left: 15 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5ece7" />
              <XAxis dataKey="year" tickFormatter={(y) => 'FY' + y} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: any) => [number(Number(v), 2) + ' ' + group.unit, 'Reported value']}
                labelFormatter={(v) => 'FY' + v}
              />
              <Line
                dataKey="value"
                stroke="#247556"
                strokeWidth={3}
                dot={{ r: 5, fill: '#247556' }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted">Add another year in this same scope to display a trend.</p>
      )}
    </Panel>
  );
}
export function History() {
  const { data, user, toast, refresh } = useWorkspace();
  const [add, setAdd] = useState(false),
    [importing, setImporting] = useState(false),
    [filter, setFilter] = useState('');
  async function remove(id: string) {
    if (
      !confirm(
        'Remove this observation and recalculate the affected claim statuses? The removal will remain in the activity log.',
      )
    )
      return;
    try {
      await mutate('/history/' + id, {}, 'DELETE');
      await refresh();
      toast('Observation removed; comparisons refreshed.');
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="HISTORICAL PERFORMANCE"
        title="Compare like with like."
        description="Store reported values with their units, year, facility and boundary. CarbonX normalises compatible units before comparison."
        action={
          user?.role !== 'reviewer' && (
            <div className="button-row">
              <button className="button secondary" onClick={() => setImporting(true)}>
                <Upload size={16} />
                Import CSV
              </button>
              <button className="button primary" onClick={() => setAdd(true)}>
                <Plus size={16} />
                Add observation
              </button>
            </div>
          )
        }
      />
      <div className="scope-note">
        <Database size={18} />
        <span>
          Historical records are reported evidence. A matching value shows consistency; it does not
          provide independent assurance.
        </span>
      </div>
      <Panel
        title="Historical observations"
        action={
          <select
            aria-label="Filter metric"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All metrics</option>
            {metrics.map((m) => (
              <option value={m} key={m}>
                {label(m)}
              </option>
            ))}
          </select>
        }
      >
        {data.history.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>METRIC / PERIOD</th>
                  <th>REPORTED</th>
                  <th>NORMALISED</th>
                  <th>FACILITY / BOUNDARY</th>
                  <th>SOURCE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.history
                  .filter((r: Item) => !filter || r.metric === filter)
                  .map((r: Item) => (
                    <tr key={r.id}>
                      <td>
                        <b>{label(r.metric)}</b>
                        <small className="block muted">FY{r.year}</small>
                      </td>
                      <td>
                        {number(r.value, 2)} {r.unit}
                      </td>
                      <td>
                        {number(r.normalized_value, 2)} {r.normalized_unit}
                      </td>
                      <td>
                        {r.facility_name || 'Company-wide'}
                        <small className="block muted">{r.boundary}</small>
                      </td>
                      <td className="wrap-cell">{r.source}</td>
                      <td>
                        {user?.role !== 'reviewer' && (
                          <button
                            className="icon-button danger"
                            title="Remove observation"
                            onClick={() => void remove(r.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Add the records behind the claim">
            Bring in water, energy, emissions, waste, renewable-share or land observations from
            previous reporting years.
          </Empty>
        )}
      </Panel>
      <HistoricalChart
        observations={data.history.filter((r: Item) => !filter || r.metric === filter)}
      />
      {add && <ObservationForm onClose={() => setAdd(false)} />}{' '}
      {importing && <CsvImport onClose={() => setImporting(false)} />}
    </>
  );
}
function FacilityForm({ onClose }: { onClose: () => void }) {
  const { toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('/facilities', Object.fromEntries(new FormData(e.currentTarget)));
      await refresh();
      toast('Facility added.');
      onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a facility" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Facility name">
          <input name="name" required minLength={2} />
        </Field>
        <div className="two-fields">
          <Field label="Latitude">
            <input name="latitude" type="number" min={-80} max={80} step="any" required />
          </Field>
          <Field label="Longitude">
            <input name="longitude" type="number" min={-180} max={180} step="any" required />
          </Field>
        </div>
        <Field label="Reporting boundary">
          <input name="boundary" required placeholder="Name the facility boundary" />
        </Field>
        <button className="button primary" disabled={busy}>
          Save facility
        </button>
      </form>
    </Modal>
  );
}
export function Environment() {
  const { data, user, toast, refresh } = useWorkspace();
  const [selected, setSelected] = useState(''),
    [add, setAdd] = useState(false),
    [busy, setBusy] = useState(false);
  const id = selected || data.facilities[0]?.id,
    facility = data.facilities.find((f: Item) => f.id === id),
    atmosphere = data.environment.find(
      (x: Item) => x.facility_id === id && x.kind === 'atmosphere',
    ),
    satellite = data.environment.find((x: Item) => x.facility_id === id && x.kind === 'satellite');
  async function weather() {
    setBusy(true);
    try {
      await mutate('/environment/weather', { facilityId: id });
      await refresh();
      toast('Atmospheric context request queued.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function imagery(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('/environment/satellite', {
        facilityId: id,
        ...Object.fromEntries(new FormData(e.currentTarget)),
      });
      await refresh();
      toast('Sentinel-2 comparison queued. This can take a minute.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ENVIRONMENTAL CONTEXT"
        title="Site data"
        description="View the selected site’s location, air quality and satellite comparison."
        action={
          user?.role !== 'reviewer' && (
            <button className="button primary" onClick={() => setAdd(true)}>
              <Plus size={16} />
              Add facility
            </button>
          )
        }
      />
      <Jobs jobs={data.jobs} />
      {facility ? (
        <>
          <div className="facility-selector">
            <MapPin size={21} />
            <select
              aria-label="Selected facility"
              value={id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {data.facilities.map((f: Item) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <span>
              {facility.latitude.toFixed(4)}, {facility.longitude.toFixed(4)} · {facility.boundary}
            </span>
          </div>
          <p className="fine-print">
            Loading context sends this selected site’s coordinates and date window to the named
            public data providers.
          </p>
          <Panel
            title="Air quality & weather"
            kicker="OPEN-METEO"
            action={
              <button
                className="button secondary"
                disabled={busy || user?.role === 'reviewer'}
                onClick={() => void weather()}
              >
                <CloudSun size={16} />
                Load current context
              </button>
            }
          >
            {atmosphere ? (
              <>
                <div className="row-between">
                  <Badge value={atmosphere.status} />
                  <small className="muted">Retrieved {date(atmosphere.created_at)}</small>
                </div>
                <div className="environment-cards">
                  {atmosphere.payload.sources?.map((s: Item) => (
                    <div className="environment-card" key={s.kind}>
                      <span className="eyebrow">{label(s.kind)}</span>
                      {s.status === 'available' ? (
                        <>
                          {s.kind === 'weather' ? (
                            <>
                              <strong>
                                {number(s.data.current?.temperature_2m, 1)}
                                <small> °C</small>
                              </strong>
                              <p>
                                Humidity {number(s.data.current?.relative_humidity_2m)}% · Wind{' '}
                                {number(s.data.current?.wind_speed_10m, 1)} km/h
                              </p>
                            </>
                          ) : (
                            <>
                              <strong>
                                {number(s.data.current?.pm2_5, 1)}
                                <small> μg/m³ PM₂.₅</small>
                              </strong>
                              <p>
                                PM₁₀ {number(s.data.current?.pm10, 1)} · NO₂{' '}
                                {number(s.data.current?.nitrogen_dioxide, 1)} μg/m³
                              </p>
                            </>
                          )}
                          <small>
                            Provider time ({s.data.timezone || 'UTC'}):{' '}
                            {s.data.current?.time || 'Not reported'}
                          </small>
                        </>
                      ) : (
                        <p className="error-text">{s.error}</p>
                      )}
                      <a href={s.source} target="_blank" rel="noreferrer" className="text-link">
                        Provider source
                        <ArrowUpRight size={13} />
                      </a>
                    </div>
                  ))}
                </div>
                <p className="chart-note">
                  {atmosphere.payload.interpretation || atmosphere.payload.error}
                </p>
              </>
            ) : (
              <Empty title="No atmospheric context loaded">
                Load weather and regional pollutant data for this facility. Missing providers remain
                unavailable rather than showing sample values.
              </Empty>
            )}
          </Panel>
          <Panel title="Vegetation & water context" kicker="SENTINEL-2 L2A · EARTH SEARCH">
            <div className="environment-visual-intro">
              <SatelliteScene />
              <div>
                <span className="eyebrow">A DIFFERENT PERSPECTIVE</span>
                <h3>Observe the site across two moments in time.</h3>
                <p>
                  Choose an earlier and later window. The comparison below uses actual satellite
                  observations when available.
                </p>
                <small>Animated illustration · not a live satellite position</small>
              </div>
            </div>
            <form className="satellite-form" onSubmit={imagery}>
              <fieldset>
                <legend>Earlier observation window</legend>
                <div className="two-fields">
                  <Field label="Start">
                    <input name="beforeStart" type="date" defaultValue="2025-01-01" required />
                  </Field>
                  <Field label="End">
                    <input name="beforeEnd" type="date" defaultValue="2025-02-01" required />
                  </Field>
                </div>
              </fieldset>
              <fieldset>
                <legend>Later observation window</legend>
                <div className="two-fields">
                  <Field label="Start">
                    <input name="afterStart" type="date" defaultValue="2026-01-01" required />
                  </Field>
                  <Field label="End">
                    <input
                      name="afterEnd"
                      type="date"
                      defaultValue="2026-02-01"
                      max={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </Field>
                </div>
              </fieldset>
              <button className="button primary" disabled={busy || user?.role === 'reviewer'}>
                <Satellite size={16} />
                Compare imagery
              </button>
            </form>
            {satellite ? (
              <>
                {satellite.status === 'available' ? (
                  <>
                    <div className="satellite-results">
                      {['before', 'after'].map((key) => {
                        const p = satellite.payload[key];
                        return (
                          <article key={key}>
                            {p.thumbnail && (
                              <img src={p.thumbnail} alt={key + ' Sentinel-2 tile overview'} />
                            )}
                            <div>
                              <span className="eyebrow">
                                {key === 'before' ? 'EARLIER SCENE' : 'LATER SCENE'}
                              </span>
                              <h3>{p.date.slice(0, 10)}</h3>
                              <dl>
                                <div>
                                  <dt>Mean NDVI</dt>
                                  <dd>{number(p.meanNDVI, 3)}</dd>
                                </div>
                                <div>
                                  <dt>Mean NDWI</dt>
                                  <dd>{number(p.meanNDWI, 3)}</dd>
                                </div>
                                <div>
                                  <dt>Clear sampled pixels</dt>
                                  <dd>{number(p.validFraction * 100, 1)}%</dd>
                                </div>
                                <div>
                                  <dt>Tile cloud cover</dt>
                                  <dd>{number(p.cloudCover, 1)}%</dd>
                                </div>
                              </dl>
                              <a
                                className="text-link"
                                href={p.source}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Scene metadata
                                <ArrowUpRight size={13} />
                              </a>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <div className="delta-strip">
                      <span>
                        NDVI change <b>{number(satellite.payload.deltaNDVI, 3)}</b>
                      </span>
                      <span>
                        NDWI change <b>{number(satellite.payload.deltaNDWI, 3)}</b>
                      </span>
                      <span>{satellite.payload.before.sampling || '1 km sample window'}</span>
                    </div>
                    <p className="chart-note">{satellite.payload.interpretation}</p>
                  </>
                ) : (
                  <div className="callout warning">
                    <b>Imagery unavailable</b>
                    <p>{satellite.payload.error}</p>
                  </div>
                )}
              </>
            ) : (
              <Empty title="Compare two observation windows">
                CarbonX selects scenes with tile cloud cover at or below 20%, masks unsuitable scene
                classes and computes NDVI and NDWI over a local sample.
              </Empty>
            )}
            <div className="scope-note">
              <Satellite size={17} />
              <span>
                Image indices provide environmental context. They do not establish facility
                emissions or independently verify a carbon credit.
              </span>
            </div>
          </Panel>
        </>
      ) : (
        <Empty
          title="Choose a site to begin"
          action={
            user?.role !== 'reviewer' && (
              <button className="button primary" onClick={() => setAdd(true)}>
                <MapPin size={16} />
                Add a facility
              </button>
            )
          }
        >
          Site coordinates and an explicit reporting boundary keep context attached to the correct
          operation.
        </Empty>
      )}
      {add && <FacilityForm onClose={() => setAdd(false)} />}
    </>
  );
}
