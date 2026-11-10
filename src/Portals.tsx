import { HomePortals } from './HomePortals';
import { takeDestination } from './role-routing';
import { SatelliteVerification } from './SatelliteView';
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Landmark,
  Globe2,
  ShieldCheck,
  Satellite,
  Wind,
  Droplets,
  Zap,
  Leaf,
  Search,
  RefreshCw,
  Radio,
  FileText,
  Eye,
  Play,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { api, mutate, date, number, label, type Item } from './api';
import { useWorkspace } from './context';
import { Brand, Badge, Empty, Modal, Panel, Field } from './components';
import { ReviewJourney, ReviewExperience, SatelliteScene, AirScene } from './VisualJourney';
const PublicMonitoringSummary = React.lazy(() =>
  import('./Monitoring').then((m) => ({ default: m.PublicMonitoringSummary })),
);
const metricNames: Record<string, string> = {
  water_consumption: 'Water consumption',
  water_withdrawal: 'Water withdrawal',
  water_recycled: 'Water recycled',
  energy_consumption: 'Energy consumption',
  energy_generated: 'Energy generated',
  emissions: 'Greenhouse gases',
  emissions_scope1: 'Scope 1 emissions',
  emissions_scope2: 'Scope 2 emissions',
  emissions_scope3: 'Scope 3 emissions',
};
function PublicCompany({ company, onClose }: { company: Item; onClose: () => void }) {
  const readings = company.readings || [],
    air = company.environmental.find((e: Item) => e.kind === 'atmosphere'),
    pm = air?.sources.find((s: Item) => s.kind === 'air_quality'),
    scene = company.environmental.find((e: Item) => e.kind === 'satellite');
  return (
    <Modal title={company.name} onClose={onClose} wide>
      <div className="public-company-heading">
        <Badge value={company.licence.status} />
        {company.isExample && <span className="illustration-label">Synthetic example company</span>}
        <small>{company.licence.number || 'Licence pending assignment'}</small>
      </div>
      <p>{company.description || 'Published company sustainability summary.'}</p>
      <Panel title="Published claim review status">
        <div className="public-metrics">
          {company.submissions.map((row: Item) => (
            <article key={row.status}>
              <Badge value={row.status} />
              <strong>
                {row.n}
                <small> claims</small>
              </strong>
            </article>
          ))}
        </div>
        <p className="fine-print">
          These are recorded review statuses. Source documents and private reviewer notes remain
          protected.
        </p>
      </Panel>
      <h3>Latest reported usage</h3>
      <p className="muted">
        Each record retains its own facility, unit and reporting year. Values are not added across
        different scopes.
      </p>
      <div className="public-metrics">
        {company.metrics.map((m: Item, i: number) => (
          <article key={i}>
            <span>{metricNames[m.metric] || label(m.metric)}</span>
            <strong>
              {number(m.value, 2)} <small>{m.unit}</small>
            </strong>
            <p>
              FY{m.year} · {m.scope}
            </p>
            <small>Recorded {date(m.recordedAt)}</small>
          </article>
        ))}
      </div>
      {!company.metrics.length && (
        <Empty title="No published historical usage">
          This company has not yet supplied historical observations.
        </Empty>
      )}
      <Panel title="Recent company-submitted readings" kicker="PUBLISHED RECORDS">
        {readings.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MEASUREMENT</th>
                  <th>VALUE</th>
                  <th>SCOPE</th>
                  <th>OBSERVED</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 15).map((r: Item, i: number) => (
                  <tr key={i}>
                    <td>{metricNames[r.metric] || label(r.metric)}</td>
                    <td>
                      {number(r.value, 2)} {r.unit}
                    </td>
                    <td>{r.scope}</td>
                    <td>{date(r.recordedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            No recent readings have been submitted. Continuous meter telemetry is not connected.
          </p>
        )}
      </Panel>
      {air && (
        <Panel title="Regional air quality" kicker="OPEN-METEO CONTEXT">
          <AirScene value={pm?.pm25 ?? null} />
          <p className="chart-note">
            Provider time: {pm?.time || 'Unavailable'} · Retrieved {date(air.retrievedAt)}. Regional
            context does not measure this facility’s emissions.
          </p>
        </Panel>
      )}
      {scene && (
        <Panel title="Satellite observation comparison">
          <div className="public-scene-comparison">
            <div>
              <span>EARLIER · {scene.before.date.slice(0, 10)}</span>
              <strong>{number(scene.before.ndvi, 3)}</strong>
              <small>Mean vegetation index</small>
            </div>
            <ArrowRight />
            <div>
              <span>LATER · {scene.after.date.slice(0, 10)}</span>
              <strong>{number(scene.after.ndvi, 3)}</strong>
              <small>Mean vegetation index</small>
            </div>
          </div>
          <p className="chart-note">
            Satellite indices add environmental context. They do not establish a carbon-credit
            finding.
          </p>
        </Panel>
      )}
      {company.notices.length > 0 && (
        <Panel title="Public notices">
          {company.notices.map((n: Item, i: number) => (
            <article className="public-notice" key={i}>
              <Badge value={n.type} />
              <p>{n.text}</p>
              <small>{date(n.created_at)}</small>
            </article>
          ))}
        </Panel>
      )}
      <p className="fine-print">
        Licence status is a CarbonX administrative record. It is not a connection to an external
        government licensing system.
      </p>
    </Modal>
  );
}
export function PublicPortal() {
  const { user } = useWorkspace();
  const [data, setData] = useState<Item | null>(null),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [examples, setExamples] = useState(true),
    [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try {
      setData(await api('/public/overview'));
      setError('');
    } catch {
      setError('The latest refresh is unavailable. Showing the last received records.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 30000);
    return () => clearInterval(t);
  }, []);
  const exampleNames = new Set<string>();
  const ordered = [...(data?.companies || [])].sort(
    (a: Item, b: Item) => Number(b.id === user?.companyId) - Number(a.id === user?.companyId),
  );
  const companies = ordered
      .filter(
        (c: Item) =>
          (examples || !c.isExample) && c.name.toLowerCase().includes(query.toLowerCase()),
      )
      .filter((c: Item) => {
        if (!c.isExample) return true;
        const key = c.name.toLowerCase();
        if (exampleNames.has(key)) return false;
        exampleNames.add(key);
        return true;
      }),
    current = data?.companies.find((c: Item) => c.id === selected),
    hasEnvironment = companies.some((c: Item) => c.environmental.length);
  return (
    <div className="public-site">
      <header className="public-nav">
        <a href="#home" aria-label="CarbonX home">
          <Brand />
        </a>
        <nav>
          <a href="#india">India observatory</a>
          <a href="#public" className="selected">
            Public transparency
          </a>
        </nav>
        <div>
          <a
            href={user?.portal === 'government' ? '#government' : '#government-login'}
            className="portal-link"
          >
            <Landmark size={16} />
            {user?.portal === 'government' ? 'Government workspace' : 'Government login'}
          </a>
          <a
            href={user?.portal === 'company' ? '#overview' : '#company-login'}
            className="button primary"
          >
            <Building2 size={16} />
            {user?.portal === 'company' ? 'My company workspace' : 'Company portal'}
            <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main>
        <section className="public-hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="status-dot" />
              CARBONX PUBLIC OBSERVATORY
            </span>
            <h1>India’s sustainability dashboard.</h1>
            <p>
              Explore live environmental context, company claims and Government Oversight from one
              place.
            </p>
            <div className="button-row">
              <a
                className="button primary"
                href="#public-registry"
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('public-registry')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore published companies
                <ArrowRight size={17} />
              </a>
            </div>
          </div>
        </section>
        <HomePortals />
        <section className="public-stat-strip">
          <div>
            <Building2 size={19} />
            <strong>{data ? companies.length : '—'}</strong>
            <span>Published companies shown</span>
          </div>
          <div>
            <ShieldCheck size={19} />
            <strong>
              {data ? companies.filter((c: Item) => c.licence.status === 'active').length : '—'}
            </strong>
            <span>Active CarbonX licences</span>
          </div>
          <div>
            <Satellite size={19} />
            <strong>{hasEnvironment ? 'Available' : 'Awaiting publication'}</strong>
            <span>Environmental observations</span>
          </div>
          <div className="public-refresh">
            <span className={'status-dot ' + (error ? 'offline' : '')} />
            <span>
              {error ? 'Refresh interrupted' : 'Public records refresh automatically'}
              <small>
                {data
                  ? 'Last refreshed ' + new Date(data.refreshedAt).toLocaleTimeString()
                  : 'Loading published records…'}
              </small>
            </span>
            <button
              aria-label="Refresh public records"
              className="icon-button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} className={busy ? 'spin' : ''} />
            </button>
          </div>
        </section>
        <section className="public-registry" id="public-registry">
          <div className="public-section-heading">
            <div>
              <span className="eyebrow">OPEN TRANSPARENCY REGISTER</span>
              <h2>Follow the evidence. See the status.</h2>
              <p>
                Usage is company-reported. Environmental observations carry their own timestamps.
                Only explicitly published summaries appear here.
              </p>
            </div>
            <div className="public-search">
              <Search size={17} />
              <input
                aria-label="Search published companies"
                placeholder="Search a company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="public-registry-options">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={examples}
                onChange={(e) => setExamples(e.target.checked)}
              />
              Include clearly labelled presentation examples
            </label>
            <span>
              {companies.length} {companies.length === 1 ? 'company' : 'companies'}
            </span>
          </div>
          {error && <p className="callout warning">{error}</p>}
          <div className="public-company-grid">
            {companies.map((c: Item) => {
              const water = c.metrics.find((m: Item) => m.metric === 'water_consumption'),
                energy = c.metrics.find((m: Item) => m.metric === 'energy_consumption');
              return (
                <button
                  className="public-company-card"
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                >
                  <div className="row-between">
                    <span className="company-monogram">{c.name.slice(0, 2).toUpperCase()}</span>
                    <Badge value={c.licence.status} />
                  </div>
                  <h3>{c.name}</h3>
                  <p>{c.description || 'Company sustainability summary'}</p>
                  {c.isExample && <span className="example-tag">Synthetic example</span>}
                  <div className="public-company-usage">
                    <div>
                      <Droplets size={17} />
                      <span>
                        Water
                        <small>
                          {water ? number(water.value) + ' ' + water.unit : 'Not reported'}
                        </small>
                      </span>
                      {water && <b>FY{water.year}</b>}
                    </div>
                    <div>
                      <Zap size={17} />
                      <span>
                        Energy
                        <small>
                          {energy ? number(energy.value) + ' ' + energy.unit : 'Not reported'}
                        </small>
                      </span>
                      {energy && <b>FY{energy.year}</b>}
                    </div>
                  </div>
                  <div className="public-card-footer">
                    <span>View published evidence</span>
                    <ArrowUpRight size={18} />
                  </div>
                </button>
              );
            })}
          </div>
          {!companies.length && (
            <Empty
              title={data ? 'No published companies in this view' : 'Loading the public register'}
            >
              Company summaries appear after a workspace owner chooses to publish them. Private
              reports and account details remain protected.
            </Empty>
          )}
          <div className="public-data-note">
            <Clock size={19} />
            <p>
              <b>Freshness you can see.</b> The page checks for updated records every 30 seconds.
              Reported annual usage is not a live meter feed. No continuously measured company usage
              feed is connected yet.
            </p>
          </div>
        </section>
        <div id="home-air-quality">
          <React.Suspense fallback={<p className="muted">Loading India monitoring…</p>}>
            <PublicMonitoringSummary />
          </React.Suspense>
        </div>
        <div id="home-satellite">
          <SatelliteVerification publicView />
        </div>
      </main>
      <footer className="public-footer">
        <Brand />
        <p>Transparency begins with a traceable record.</p>
        <span>
          CarbonX · Government Oversight is an application role, not an official government
          affiliation.
        </span>
      </footer>
      {current && <PublicCompany company={current} onClose={() => setSelected(null)} />}
    </div>
  );
}
export function PortalLogin({ portal }: { portal: 'company' | 'government' }) {
  const government = portal === 'government',
    { signIn, toast } = useWorkspace();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [config, setConfig] = useState<Item>({});
  useEffect(() => {
    api('/public/config')
      .then(setConfig)
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      const result = await mutate('/auth/' + (register ? 'register' : 'login'), {
        ...values,
        portal,
      });
      if (result.verificationRequired) {
        toast(result.message);
        setRegister(false);
        return;
      }
      signIn(result);
      location.hash = government ? 'government' : 'overview';
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    try {
      signIn(await mutate('/auth/demo', { portal }));
      location.hash = government ? 'government' : 'overview';
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={'portal-auth ' + (government ? 'government-auth' : '')}>
      <div className="portal-auth-story">
        <a href="#public">
          <Brand />
        </a>
        <span className="eyebrow">{government ? 'GOVERNMENT OVERSIGHT' : 'COMPANY WORKSPACE'}</span>
        <h1>
          {government ? (
            <>
              Confidence through
              <br />
              <em>accountable oversight.</em>
            </>
          ) : (
            <>
              Your claims.
              <br />
              <em>The evidence behind them.</em>
            </>
          )}
        </h1>
        <p>
          {government
            ? 'Review the evidence, follow up on concerns and record decisions that people can understand.'
            : 'Submit sustainability claims, organise your reports and share a clear picture of your resource use.'}
        </p>
        <a href="#public" className="auth-back">
          <ArrowLeftIcon />
          Back to public transparency
        </a>
      </div>
      <div className="portal-auth-form">
        <div>
          <span className="portal-auth-icon">
            {government ? <Landmark size={27} /> : <Building2 size={27} />}
          </span>
          <span className="eyebrow">{government ? 'GOVERNMENT ACCESS' : 'COMPANY ACCESS'}</span>
          <h2>
            {register
              ? 'Create a company workspace'
              : government
                ? 'Government sign in'
                : 'Company sign in'}
          </h2>
          <p>
            {government
              ? 'Use the account issued by your administrator.'
              : 'Manage the reports, claims and records belonging to your company.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <>
                <Field label="Your name">
                  <input name="name" required minLength={2} autoComplete="name" />
                </Field>
                <Field label="Company name">
                  <input name="company" required minLength={2} autoComplete="organization" />
                </Field>
              </>
            )}
            <Field label="Email address">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
            </Field>
            <button className="button primary full" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create company workspace' : 'Sign in'}
              <ArrowRight size={17} />
            </button>
          </form>
          {!government && config.allowRegistration && (
            <button className="auth-switch" onClick={() => setRegister(!register)}>
              {register ? 'Already registered? Sign in' : 'New company? Create a workspace'}
            </button>
          )}
          {config.allowDemo && (
            <>
              <div className="auth-divider">
                <span>PROJECT REVIEW</span>
              </div>
              <button className="button secondary full" disabled={busy} onClick={() => void demo()}>
                {government ? 'Explore government demo' : 'Explore company demo'}
                <Eye size={17} />
              </button>
              <p className="fine-print">
                A separate synthetic workspace for your presentation.
                {government ? ' Administrative actions are restricted to its example company.' : ''}
              </p>
            </>
          )}
          <a
            className="portal-other-login"
            href={government ? '#company-login' : '#government-login'}
          >
            {government ? 'Looking for company access?' : 'Looking for Government Oversight?'}
            <ChevronRight size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}
function ArrowLeftIcon() {
  return <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />;
}
