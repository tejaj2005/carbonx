import { AirTrend } from './TrendChart';
import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Plus,
  Radio,
  MapPin,
  Clock,
  ShieldAlert,
  ExternalLink,
  RefreshCw,
  Database,
  Building2,
  Landmark,
  Globe2,
  Activity,
  ChevronRight,
  Wind,
  Thermometer,
  Sparkles,
  Pause,
  Play,
} from 'lucide-react';
import { api, mutate, label, date, number, type Item } from './api';
import { useWorkspace } from './context';
import { Brand, Heading, Panel, Empty, Field, Modal, Badge } from './components';
const metrics = [
  ['ghg', 'Greenhouse-gas total'],
  ['pm_stack', 'Stack particulate matter'],
  ['so2_stack', 'Stack sulphur dioxide'],
  ['nox_stack', 'Stack nitrogen oxides'],
  ['co_stack', 'Stack carbon monoxide'],
];
const unitFor = (m: string) => (m === 'ghg' ? 'tCO2e' : 'mg/Nm3');
const localTime = (t: number) =>
  new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
function RuleForm({ close }: { close: () => void }) {
  const { data, toast, refresh } = useWorkspace(),
    m = data.monitoring;
  const [company, setCompany] = useState(data.government.companies[0]?.id || ''),
    [metric, setMetric] = useState('ghg'),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('/monitoring/rules', Object.fromEntries(new FormData(e.currentTarget)));
      await refresh();
      toast('Operational threshold saved. Matching observations will be assessed.');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Configure an emissions threshold" onClose={close}>
      <div className="callout info">
        Use the applicable facility reference and measurement basis. CarbonX does not supply a
        universal legal emissions limit or automatically suspend a licence.
      </div>
      <form className="form-grid" onSubmit={save}>
        <Field label="Company">
          <select
            name="companyId"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          >
            {data.government.companies.map((c: Item) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Facility">
          <select name="facilityId" required>
            <option value="">Select a facility</option>
            {m.facilities
              .filter((f: Item) => f.company_id === company)
              .map((f: Item) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Metric">
          <select name="metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {metrics.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Threshold">
            <input name="threshold" type="number" min={0.000001} step="any" required />
          </Field>
          <Field label="Unit">
            <input name="unit" value={unitFor(metric)} readOnly />
          </Field>
        </div>
        <div className="two-fields">
          <Field label="Averaging/reporting period (minutes)">
            <input
              name="windowMinutes"
              type="number"
              min={1}
              max={527040}
              defaultValue={60}
              required
            />
          </Field>
          <Field label="Maximum data age (minutes)">
            <input
              name="maxAgeMinutes"
              type="number"
              min={1}
              max={527040}
              defaultValue={180}
              required
            />
          </Field>
        </div>
        <Field label="Measurement basis">
          <select
            name="measurementBasis"
            key={metric}
            defaultValue={metric === 'ghg' ? 'period_total' : 'dry_normalised'}
          >
            {metric === 'ghg' ? (
              <option value="period_total">Total over the reporting period</option>
            ) : (
              <>
                <option value="dry_normalised">Dry, normalised gas concentration</option>
                <option value="wet_normalised">Wet, normalised gas concentration</option>
              </>
            )}
          </select>
        </Field>
        <Field label="Applicable permit, consent clause or policy reference">
          <textarea name="sourceReference" required minLength={5} maxLength={500} />
        </Field>
        <button className="button primary" disabled={busy}>
          Save operational threshold
        </button>
      </form>
    </Modal>
  );
}
function EmissionForm({ close }: { close: () => void }) {
  const { data, toast, refresh } = useWorkspace();
  const [metric, setMetric] = useState('ghg'),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await mutate('/company/emissions', {
        ...b,
        periodStart: new Date(String(b.periodStart)).toISOString(),
        periodEnd: new Date(String(b.periodEnd)).toISOString(),
      });
      await refresh();
      toast('Observation recorded and matching thresholds evaluated.');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Submit an emissions observation" onClose={close}>
      <p className="modal-intro">
        Enter an actual observed period and reference. This is stored as company-reported data. No
        automatic OCEMS feed is connected.
      </p>
      <form className="form-grid" onSubmit={save}>
        <Field label="Facility">
          <select name="facilityId" required>
            {data.facilities.map((f: Item) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Metric">
          <select name="metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {metrics.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Observed value">
            <input name="value" type="number" min={0} step="any" required />
          </Field>
          <Field label="Unit">
            <input name="unit" value={unitFor(metric)} readOnly />
          </Field>
        </div>
        <div className="two-fields">
          <Field label="Period start">
            <input
              name="periodStart"
              type="datetime-local"
              defaultValue={localTime(Date.now() - 3600000)}
              required
            />
          </Field>
          <Field label="Period end">
            <input
              name="periodEnd"
              type="datetime-local"
              defaultValue={localTime(Date.now())}
              required
            />
          </Field>
        </div>
        <Field label="Measurement basis">
          <select
            name="measurementBasis"
            key={metric}
            defaultValue={metric === 'ghg' ? 'period_total' : 'dry_normalised'}
          >
            {metric === 'ghg' ? (
              <option value="period_total">Total over the reporting period</option>
            ) : (
              <>
                <option value="dry_normalised">Dry, normalised gas concentration</option>
                <option value="wet_normalised">Wet, normalised gas concentration</option>
              </>
            )}
          </select>
        </Field>
        <Field label="Data quality">
          <select name="quality">
            <option value="valid">Valid according to the supplied record</option>
            <option value="invalid">Invalid / flagged instrument data</option>
          </select>
        </Field>
        <Field label="Source reference">
          <textarea name="sourceReference" required minLength={5} maxLength={500} />
        </Field>
        <button className="button primary" disabled={busy}>
          Save and assess observation
        </button>
      </form>
    </Modal>
  );
}
function CityCards({ cities, select }: { cities: Item[]; select?: (c: Item) => void }) {
  return (
    <div className="metro-grid">
      {cities.map((c) => {
        const model = c.model;
        return (
          <button
            key={c.id}
            className={'metro-card ' + (c.freshness === 'stale' ? 'metro-stale' : '')}
            onClick={() => select?.(c)}
          >
            <div className="row-between">
              <span>
                <MapPin size={15} />
                {c.name}
              </span>
              <Badge value={c.freshness} />
            </div>
            <small>{c.state}</small>
            <div className="metro-reading">
              <Wind size={24} />
              <strong>
                {number(model?.air?.pm25, 1)}
                <small> µg/m³</small>
              </strong>
            </div>
            <b>PM₂.₅ · current model estimate</b>
            <div className="metro-mini">
              <span>
                PM₁₀ <b>{number(model?.air?.pm10, 1)}</b>
              </span>
              <span>
                <Thermometer size={12} />
                {number(model?.weather?.temperature, 1)} °C
              </span>
            </div>
            <div className="metro-source-time">
              <Clock size={12} />
              <span>{model?.validAt ? date(model.validAt) : 'Waiting for provider data'}</span>
            </div>
            <footer>
              {c.stations?.records?.length
                ? c.stations.records.length + ' official station summaries'
                : c.stations?.status === 'not_configured'
                  ? 'Official stations: API key required'
                  : 'Official stations: no current records'}
              <ChevronRight size={14} />
            </footer>
            {c.error && (
              <span className="metro-error">
                Latest fetch unavailable; retained data may be stale
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
function CityDetail({ city, close }: { city: Item; close: () => void }) {
  const m = city.model,
    s = city.stations;
  return (
    <Modal title={city.name + ' · environmental sources'} wide onClose={close}>
      <AirTrend points={city.model?.trend || []} />
      <div className="scope-note">
        <Wind size={18} />
        <span>Regional atmospheric context cannot establish a company-emissions violation.</span>
      </div>
      <Panel title="Modelled atmospheric context" kicker="OPEN-METEO / CAMS GLOBAL">
        {m ? (
          <>
            <div className="metro-detail-metrics">
              <div>
                <span>PM₂.₅</span>
                <strong>
                  {number(m.air?.pm25, 1)} <small>µg/m³</small>
                </strong>
              </div>
              <div>
                <span>PM₁₀</span>
                <strong>
                  {number(m.air?.pm10, 1)} <small>µg/m³</small>
                </strong>
              </div>
              <div>
                <span>Temperature</span>
                <strong>
                  {number(m.weather?.temperature, 1)} <small>°C</small>
                </strong>
              </div>
            </div>
            <p className="chart-note">
              Forecast valid at {m.validAt ? date(m.validAt) : 'Unavailable'} · Retrieved{' '}
              {date(m.retrievedAt)}
            </p>
            <p>{m.resolution}. These are provider model outputs, not local sensor measurements.</p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MODELLED SUMMARY</th>
                    <th>COMPLETED 24-HOUR MEAN</th>
                    <th>COVERAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {m.means.map((v: Item) => (
                    <tr key={v.metric}>
                      <td>{v.metric === 'pm25' ? 'PM₂.₅' : 'PM₁₀'}</td>
                      <td>{v.complete ? number(v.value, 1) + ' µg/m³' : 'Not assessed'}</td>
                      <td>{v.samples}/24 hourly outputs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty title="Waiting for a successful provider request">
            The monitor does not substitute synthetic values.
          </Empty>
        )}
      </Panel>
      <Panel title="Official measured station summaries" kicker="CPCB / DATA.GOV.IN">
        <p className="fine-print">
          {s?.accessMode === 'public_sample'
            ? 'Official public sample · maximum 10 records per request. '
            : ''}
          {s?.error || s?.note}
        </p>
        <Badge value={s?.status || 'unavailable'} />
        {s?.records?.length ? (
          <>
            <p className="callout info">
              Provider units and averaging periods are not assumed. These records are not
              automatically compared against a regulatory standard.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>STATION</th>
                    <th>POLLUTANT</th>
                    <th>PROVIDER AVERAGE</th>
                    <th>UNIT / PERIOD</th>
                    <th>UPDATED</th>
                  </tr>
                </thead>
                <tbody>
                  {s.records.slice(0, 80).map((r: Item, i: number) => (
                    <tr key={i}>
                      <td>{r.station}</td>
                      <td>{r.pollutant}</td>
                      <td>{number(r.average, 2)}</td>
                      <td>
                        {r.unit || 'Not supplied'} · {r.averagingPeriod || 'Unknown period'}
                      </td>
                      <td>{r.observedAt ? date(r.observedAt) : r.providerTime || 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty
            title={
              s?.status === 'not_configured'
                ? 'Free station API key required'
                : 'No measured records received'
            }
          >
            {s?.status === 'not_configured'
              ? 'Configure DATA_GOV_IN_API_KEY on the server to request official CPCB station summaries. Until then, no measured station values are claimed.'
              : s?.error ||
                s?.note ||
                'The station provider returned no usable records. Check the last update and provider availability.'}
          </Empty>
        )}
      </Panel>
      <a
        className="text-link"
        href="https://open-meteo.com/en/docs/air-quality-api"
        target="_blank"
        rel="noreferrer"
      >
        Source methodology
        <ExternalLink size={14} />
      </a>
    </Modal>
  );
}
export function MonitoringPage() {
  const { data, user, refresh, toast } = useWorkspace(),
    m = data.monitoring,
    government = user?.portal === 'government';
  const [modal, setModal] = useState<'rule' | 'sample' | null>(null),
    [city, setCity] = useState<Item | null>(null),
    [watch, setWatch] = useState<string[]>(m.watch),
    [busy, setBusy] = useState(false);
  useEffect(() => setWatch(m.watch), [m.watch.join(',')]);
  useEffect(() => {
    const t = setInterval(() => void refresh(), 30000);
    return () => clearInterval(t);
  }, [refresh]);
  async function saveWatch() {
    try {
      await mutate('/monitoring/watch', { cities: watch });
      await refresh();
      toast('City advisory subscriptions saved.');
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function read(id: string) {
    try {
      await mutate('/notifications/' + id + '/read', {}, 'PATCH');
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function explain(id: string) {
    setBusy(true);
    try {
      await mutate('/monitoring/alerts/' + id + '/explain');
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(r: Item) {
    try {
      await mutate('/monitoring/rules/' + r.id, { active: !r.active }, 'PATCH');
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="INDIA · MONITORING & NOTIFICATIONS"
        title="Emissions & alerts"
        description="Check reported emissions, limits and notifications."
        action={
          (government || user?.role !== 'reviewer') && (
            <button
              className="button primary"
              onClick={() => setModal(government ? 'rule' : 'sample')}
            >
              <Plus size={16} />
              {government ? 'Configure emissions threshold' : 'Submit emissions observation'}
            </button>
          )
        }
      />
      <div className="monitoring-disclaimer">
        <ShieldAlert size={21} />
        <p>
          City air quality is regional context. Company alerts use facility readings and configured
          limits. Licence decisions require government review.
        </p>
      </div>
      <EmissionOverview rules={m.rules} facilities={m.facilities} />
      <Panel title="Your notifications" kicker="DELIVERED IN CARBONX">
        {m.notifications.length ? (
          <div className="notification-list">
            {m.notifications.map((n: Item) => (
              <article className={n.read_at ? 'read' : ''} key={n.id}>
                <span className="notification-icon">
                  <Bell size={18} />
                </span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.message}</p>
                  <small>{date(n.created_at)} · In-app</small>
                </div>
                {!n.read_at && (
                  <button
                    className="icon-button"
                    aria-label={'Mark notification read: ' + n.title}
                    onClick={() => void read(n.id)}
                  >
                    <CheckCheck size={18} />
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No notifications yet">
            Threshold advisories, company submissions and government decisions appear here. Email
            and SMS are not configured.
          </Empty>
        )}
      </Panel>
      <Panel title="Monitoring connections">
        <div className="monitor-health-grid">
          <div>
            <Activity size={19} />
            <span>
              <b>Background metro updates</b>
              <small>
                {m.monitorEnabled ? 'Enabled while this server is running' : 'Disabled'} · every{' '}
                {m.pollMinutes || 30} minutes
              </small>
            </span>
          </div>
          <div>
            <Database size={19} />
            <span>
              <b>Official CPCB station source</b>
              <small>
                {m.stationConfigured
                  ? m.stationAccessMode === 'sample'
                    ? 'Official public sample · maximum 10 records per request'
                    : 'Personal key configured; inspect record availability'
                  : 'Free data.gov.in key required'}
              </small>
            </span>
          </div>
          <div>
            <Radio size={19} />
            <span>
              <b>Continuous factory emissions feed</b>
              <small>Not connected · company-reported observations supported</small>
            </span>
          </div>
          <div>
            <Sparkles size={19} />
            <span>
              <b>AI explanation</b>
              <small>
                {m.ai.configured
                  ? 'Configured · inference results show the model and generation time'
                  : 'Add your AI provider key to enable AI'}
              </small>
            </span>
          </div>
        </div>
      </Panel>
      <Panel
        title="Facility thresholds & assessments"
        action={
          government && (
            <button className="text-link" onClick={() => setModal('rule')}>
              <Plus size={14} />
              Add threshold
            </button>
          )
        }
      >
        {m.rules.length ? (
          <div className="threshold-list">
            {m.rules.map((r: Item) => (
              <article key={r.id}>
                <div className="row-between">
                  <h3>{metrics.find(([id]) => id === r.metric)?.[1] || r.metric}</h3>
                  <Badge value={!r.active ? 'disabled' : r.assessment.status} />
                </div>
                <small>
                  {m.facilities.find((f: Item) => f.id === r.facility_id)?.name || 'Facility'}
                  {government
                    ? ' · ' +
                      (data.government.companies.find((c: Item) => c.id === r.company_id)?.name ||
                        'Company')
                    : ''}
                </small>
                <p>
                  Threshold{' '}
                  <b>
                    {r.threshold} {r.unit}
                  </b>{' '}
                  · {r.window_minutes}-minute period · {label(r.measurement_basis)}
                </p>
                <p className="muted">{r.assessment.reason}</p>
                <small>Reference: {r.source_reference}</small>
                {r.sample && (
                  <small>
                    Source: {r.sample.source_kind} · Period ended {date(r.sample.period_end)}
                  </small>
                )}
                {government && (
                  <button className="text-link" onClick={() => void toggle(r)}>
                    {r.active ? <Pause size={14} /> : <Play size={14} />}{' '}
                    {r.active ? 'Pause threshold' : 'Enable threshold'}
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No facility threshold has been configured">
            An administrator must supply the applicable facility reference. There is no universal
            company emissions limit prefilled.
          </Empty>
        )}
      </Panel>
      <Panel title="Threshold alert history">
        {m.alerts.length ? (
          <div className="threshold-list">
            {m.alerts.map((a: Item) => (
              <article key={a.id}>
                <div className="row-between">
                  <h3>{a.title}</h3>
                  <Badge value={a.status} />
                </div>
                <p>{a.message}</p>
                <small>
                  {date(a.created_at)} ·{' '}
                  {a.kind === 'ambient_model_advisory'
                    ? 'Regional model advisory'
                    : 'Company-reported threshold alert'}
                </small>
                {a.ai && (
                  <div className="callout info">
                    <b>AI-assisted explanation · {a.ai.model}</b>
                    <p>{a.ai.summary}</p>
                    {a.ai.cautions.map((c: string, i: number) => (
                      <p key={i}>{c}</p>
                    ))}
                  </div>
                )}
                {m.ai.configured && (
                  <button className="text-link" disabled={busy} onClick={() => void explain(a.id)}>
                    <Sparkles size={14} />
                    Explain with AI
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No threshold alerts recorded">
            Missing or stale data remains not assessed rather than appearing within a limit.
          </Empty>
        )}
      </Panel>
      {!government && (
        <Panel title="Choose metropolitan advisory notifications">
          <div className="city-watch-options">
            {m.cities.map((c: Item) => (
              <label className="checkbox" key={c.id}>
                <input
                  type="checkbox"
                  checked={watch.includes(c.id)}
                  disabled={user?.role !== 'owner'}
                  onChange={(e) =>
                    setWatch(
                      e.target.checked ? [...watch, c.id] : watch.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
          {user?.role === 'owner' && (
            <button className="button secondary" onClick={() => void saveWatch()}>
              Save city subscriptions
            </button>
          )}
          <p className="chart-note">
            These advisories concern regional modelled conditions, not emissions attributed to your
            company.
          </p>
        </Panel>
      )}
      <Heading
        eyebrow="METROPOLITAN OBSERVATORY"
        title="A source-aware view of India’s main cities."
        description="Actual provider responses with clear model/station labels, validity times and unavailable states."
      />
      <CityCards cities={m.cities} select={setCity} />
      <p className="chart-note">{m.sources?.attribution}</p>
      {modal === 'rule' && <RuleForm close={() => setModal(null)} />}
      {modal === 'sample' && <EmissionForm close={() => setModal(null)} />}
      {city && (
        <CityDetail
          city={m.cities.find((c: Item) => c.id === city.id) || city}
          close={() => setCity(null)}
        />
      )}
    </>
  );
}
export function PublicIndia() {
  const [data, setData] = useState<Item | null>(null),
    [error, setError] = useState(''),
    [city, setCity] = useState<Item | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      setData(await api('/public/india'));
      setError('');
    } catch {
      setError('Refresh unavailable. Retained source times still apply.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="public-site india-public">
      <header className="public-nav">
        <a href="#public">
          <Brand />
        </a>
        <nav>
          <a href="#public">Company transparency</a>
          <a href="#india" className="selected">
            India observatory
          </a>
        </nav>
        <div>
          <a href="#government-login" className="portal-link">
            <Landmark size={16} />
            Government login
          </a>
          <a href="#company-login" className="button primary">
            <Building2 size={16} />
            Company portal
          </a>
        </div>
      </header>
      <main className="india-public-content">
        <Heading
          eyebrow="INDIA · METROPOLITAN OBSERVATORY"
          title="India air quality"
          description="Latest available air-quality data for eight major Indian cities."
          action={
            <button className="button secondary" disabled={busy} onClick={() => void load()}>
              <RefreshCw size={16} className={busy ? 'spin' : ''} />
              Refresh view
            </button>
          }
        />
        <div className="india-source-strip">
          <span>
            <Activity size={17} />
            Provider fetches every {data?.pollMinutes || 30} minutes
          </span>
          <span>
            <Clock size={17} />
            Display refresh every 30 seconds
          </span>
          <span>
            <Database size={17} />
            {data?.stationConfigured ? 'Station key configured' : 'Official station key required'}
          </span>
        </div>
        <div className="monitoring-disclaimer">
          <ShieldAlert size={21} />
          <p>
            These are regional model estimates, not factory measurements. Select a city for its data
            and source details.
          </p>
        </div>
        {error && <p className="callout warning">{error}</p>}
        <CityCards cities={data?.cities || []} select={setCity} />
        {!data && (
          <Empty title="Loading metropolitan sources">No sample readings are substituted.</Empty>
        )}
        <details className="simple-details">
          <summary>About the data</summary>
          <p>
            Official CPCB station summaries need a free data.gov.in API key. Their units and
            averaging periods must be confirmed before compliance comparison. Continuous factory
            emissions require authorised facility data and the applicable permit or consent limits.
          </p>
          <p className="chart-note">
            This page uses public city coordinates. Company reports, account details and private
            monitoring observations are not published here.
          </p>
        </details>
        <footer className="india-attribution">
          <p>{data?.sources?.attribution}</p>
          <a href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">
            Model source & resolution
            <ExternalLink size={13} />
          </a>
          <a
            href="https://www.data.gov.in/resource/real-time-air-quality-index-various-locations"
            target="_blank"
            rel="noreferrer"
          >
            Official station source
            <ExternalLink size={13} />
          </a>
          <a href="https://open-meteo.com/en/terms" target="_blank" rel="noreferrer">
            Free research-use terms
            <ExternalLink size={13} />
          </a>
        </footer>
      </main>
      {city && <CityDetail city={city} close={() => setCity(null)} />}
    </div>
  );
}

function EmissionOverview({ rules, facilities }: { rules: Item[]; facilities: Item[] }) {
  const active = rules.filter((r) => r.active),
    above = active.filter((r) => r.assessment.status === 'above_threshold'),
    assessed = active.filter((r) => r.assessment.status !== 'not_assessed');
  return (
    <section className="emissions-overview panel">
      <div className="row-between">
        <div>
          <span className="eyebrow">FACILITY EMISSIONS · COMPANY-REPORTED EVIDENCE</span>
          <h2>Emissions summary</h2>
        </div>
        <span className="source-chip light">No automatic licence action</span>
      </div>
      <div className="emission-stats">
        <div>
          <strong>{active.length}</strong>
          <span>Active thresholds</span>
        </div>
        <div>
          <strong>{above.length}</strong>
          <span>Need follow-up</span>
        </div>
        <div>
          <strong>{active.length - assessed.length}</strong>
          <span>Not assessed</span>
        </div>
      </div>
      {active.length ? (
        <div className="emission-rows">
          {active.map((r) => {
            const usable = r.assessment.status !== 'not_assessed',
              ratio = usable && r.sample ? (Number(r.sample.value) / r.threshold) * 100 : 0;
            return (
              <div className="emission-row" key={r.id}>
                <div>
                  <strong>
                    {facilities.find((f) => f.id === r.facility_id)?.name || 'Facility'}
                  </strong>
                  <small>
                    {metrics.find(([id]) => id === r.metric)?.[1]} · {r.window_minutes}-minute
                    period
                  </small>
                </div>
                <div className="emission-ratio">
                  <i
                    style={{
                      width: Math.min(100, ratio / 1.5) + '%',
                      background: r.assessment.status === 'above_threshold' ? '#bd704c' : '#3f7955',
                    }}
                  />
                  <span style={{ left: 100 / 1.5 + '%' }} title="Configured threshold" />
                </div>
                <div>
                  <b>
                    {usable && r.sample ? number(r.sample.value, 2) + ' ' + r.unit : 'Not assessed'}
                  </b>
                  <small>
                    Threshold {number(r.threshold, 2)} {r.unit}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="chart-note">
          No facility thresholds yet. Government Oversight supplies the applicable reference;
          company observations are assessed only when the unit, basis, quality and full period
          match.
        </p>
      )}
      <p className="chart-note">
        Each marker is that row's configured threshold. Bars show a relative comparison, capped at
        150%. Different pollutants and units are never added together. Stale or missing readings
        remain unassessed.
      </p>
    </section>
  );
}

export function PublicMonitoringSummary() {
  const [data, setData] = useState<Item | null>(null),
    [city, setCity] = useState<Item | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await api('/public/india');
        if (active) {
          setData(next);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const chosen = data?.cities.find((c: Item) => c.id === city?.id) || city;
  return (
    <Panel title="India live environmental context" kicker="PUBLIC · EIGHT METROPOLITAN CITIES">
      <p className="fine-print">
        Regional air-quality models in µg/m³ · provider fetches every {data?.pollMinutes || 30}{' '}
        minutes · display refresh every 30 seconds. Station observations are shown separately with
        their own source times.
      </p>
      {error && (
        <p className="error-text">
          Refresh unavailable. Last received readings retain their source timestamps.
        </p>
      )}
      <CityCards cities={data?.cities || []} select={setCity} />
      {chosen && <CityDetail city={chosen} close={() => setCity(null)} />}
      <small className="muted">
        Records refreshed {data?.refreshedAt ? date(data.refreshedAt) : 'when connected'}. Regional
        context does not measure any individual factory’s emissions.
      </small>
    </Panel>
  );
}
