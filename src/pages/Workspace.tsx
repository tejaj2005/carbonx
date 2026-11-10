import { ExportReport } from '../ExportReport';
import React, { useEffect, useState } from 'react';
import {
  FileText,
  ScanSearch,
  Sprout,
  ShieldCheck,
  ArrowUpRight,
  Plus,
  Upload,
  Download,
  BookOpen,
  ArrowRight,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { api, mutate, number, date, label, type Item } from '../api';
import { useWorkspace } from '../context';
import {
  Badge,
  Heading,
  Empty,
  Panel,
  SdgChips,
  Modal,
  Field,
  Jobs,
  SourceLink,
} from '../components';
export function Dashboard() {
  const { data, user, openClaim } = useWorkspace(),
    d = data.dashboard,
    s = d.stats;
  const cards = [
    ['Reports analysed', s.reports || 0, FileText, 'Persistent report library'],
    ['Claims extracted', s.claims || 0, ScanSearch, 'Every finding has a source'],
    [
      'Goals represented',
      number(s.mappedGoals) + ' / 17',
      Sprout,
      'Mappings suggested from claims',
    ],
    ['Reviewed by people', s.reviewed || 0, ShieldCheck, 'Decisions with recorded rationale'],
  ] as const;
  const covered = d.coverage.filter((g: Item) => g.count > 0);
  return (
    <>
      <Heading
        eyebrow="YOUR SUSTAINABILITY WORKSPACE"
        title="Clarity starts with evidence."
        description="Understand what your reports say, what supports each claim, and where a closer review is needed."
        action={
          <a href="#reports" className="button primary">
            <Plus size={17} />
            Upload a report
          </a>
        }
      />
      <p className="fine-print">
        Live stored-record counts · refreshed{' '}
        {data.refreshedAt ? date(data.refreshedAt) : 'when connected'} · automatic refresh every 30
        seconds.
      </p>
      <Jobs jobs={data.jobs} />
      <div className="metric-grid">
        {cards.map(([title, value, Icon, foot]) => (
          <article className="metric-card" key={title}>
            <div>
              <span>{title}</span>
              <i>
                <Icon size={18} />
              </i>
            </div>
            <strong>{value}</strong>
            <small>{foot}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <Panel
          title="Claims across the SDGs"
          kicker="REPORTED TOPICS"
          action={
            <a className="text-link" href="#claims">
              Explore mappings <ArrowUpRight size={15} />
            </a>
          }
        >
          {covered.length ? (
            <>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={covered}>
                    <CartesianGrid vertical={false} stroke="#edf1ed" />
                    <XAxis
                      label={{ value: 'SDG goal', position: 'insideBottom', offset: -5 }}
                      height={42}
                      dataKey="id"
                      tickFormatter={(x) => 'SDG ' + x}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      label={{
                        value: 'Claims (count)',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 10 },
                      }}
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [v, 'Claims']}
                      labelFormatter={(v) => 'SDG ' + v}
                    />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
                      {covered.map((g: Item) => (
                        <Cell key={g.id} fill={g.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-note">
                Counts show topics represented in reports, not progress against UN targets.
              </p>
            </>
          ) : (
            <Empty title="Your SDG map starts here">
              Upload a report to see which goals its claims relate to.
            </Empty>
          )}
        </Panel>
        <Panel title="The review picture" kicker="EVIDENCE & JUDGMENT">
          <div
            className="review-ring"
            style={
              {
                '--progress': s.claims ? (s.reviewed / s.claims) * 100 + '%' : '0%',
              } as React.CSSProperties
            }
          >
            <div>
              <strong>
                {s.claims ? Math.round((s.reviewed / s.claims) * 100) : 0}
                <small>%</small>
              </strong>
              <span>human reviewed</span>
            </div>
          </div>
          <div className="status-summary">
            <span>
              <i className="dot green" />
              Supported by records<b>{s.supported || 0}</b>
            </span>
            <span>
              <i className="dot amber" />
              Evidence or review needed<b>{s.needsReview || 0}</b>
            </span>
            <span>
              <i className="dot gray" />
              Awaiting human review<b>{Math.max(0, (s.claims || 0) - (s.reviewed || 0))}</b>
            </span>
          </div>
          <a className="button secondary full" href="#claims">
            Open the review queue
            <ArrowRight size={15} />
          </a>
        </Panel>
      </div>
      <div className="dashboard-columns lower">
        <Panel
          title="Recent reports"
          kicker="REPORT LIBRARY"
          action={
            <a href="#reports" className="text-link">
              View library
              <ArrowUpRight size={15} />
            </a>
          }
        >
          {d.recentReports.length ? (
            <div className="simple-list">
              {d.recentReports.map((r: Item) => (
                <a href="#reports" key={r.id}>
                  <i>
                    <FileText size={19} />
                  </i>
                  <span>
                    <b>{r.name}</b>
                    <small>
                      FY{r.year} · {r.page_count} source pages · {r.claim_count} claims
                    </small>
                  </span>
                  <Badge value={r.status} />
                </a>
              ))}
            </div>
          ) : (
            <Empty title="No reports yet">Add your first sustainability or annual report.</Empty>
          )}
        </Panel>
        <Panel title="Recent activity" kicker="TRACEABLE BY DESIGN">
          {d.recentActivity.length ? (
            <div className="activity-list">
              {d.recentActivity.map((a: Item) => (
                <div key={a.id}>
                  <i />
                  <span>
                    <b>{label(a.action.replaceAll('.', ' '))}</b>
                    <small>
                      {a.actor || 'Processing service'} · {date(a.created_at)}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="A clear record of your work">
              Uploads, processing and reviews will appear here.
            </Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
function UploadReport({ onClose }: { onClose: () => void }) {
  const { data, toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [boundary, setBoundary] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/reports/upload', { method: 'POST', body: new FormData(e.currentTarget) });
      toast('Report received. Processing will continue in the background.');
      await refresh();
      onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a sustainability report" onClose={onClose}>
      <p className="modal-intro">
        Keep the reporting year and boundary consistent with the historical evidence you plan to
        compare.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Report name">
          <input name="name" required minLength={2} placeholder="Sustainability report FY2024" />
        </Field>
        <div className="two-fields">
          <Field label="Reporting year (ending)">
            <input
              name="year"
              type="number"
              required
              min={1990}
              max={2100}
              defaultValue={new Date().getFullYear() - 1}
            />
          </Field>
          <Field label="Facility">
            <select
              name="facilityId"
              defaultValue=""
              onChange={(e) => {
                const f = data.facilities.find((f: Item) => f.id === e.target.value);
                if (f) setBoundary(f.boundary);
              }}
            >
              <option value="">Company-wide / no facility</option>
              {data.facilities.map((f: Item) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Reporting boundary"
          hint="For example, all company operations or the named factory boundary."
        >
          <input
            name="boundary"
            value={boundary}
            onChange={(e) => setBoundary(e.target.value)}
            required
            minLength={2}
            placeholder="All company operations"
          />
        </Field>
        <label className="upload-drop">
          <Upload size={28} />
          <strong>Select your report</strong>
          <span>PDF or UTF-8 TXT · up to {data.settings.maxUploadMB || 25} MB</span>
          <input name="report" type="file" accept=".pdf,.txt" required />
        </label>
        <div className="callout info">
          <b>
            {data.settings.providers.hostedAI?.configured
              ? 'AI processing configured'
              : 'Keyword baseline processing'}
          </b>
          <p>
            {data.settings.providers.hostedAI?.configured
              ? 'Extracted passages will be sent to the configured AI provider for claim analysis.'
              : 'No AI processor is configured. The local keyword baseline will extract candidate claims and suggest SDGs.'}
          </p>
        </div>
        <button className="button primary full" disabled={busy}>
          {busy ? 'Receiving report…' : 'Upload & analyse'}
          <ArrowRight size={16} />
        </button>
      </form>
    </Modal>
  );
}
function ReportDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { toast, refresh, openClaim, user } = useWorkspace();
  const [report, setReport] = useState<Item | null>(null),
    [page, setPage] = useState<Item | null>(null);
  useEffect(() => {
    api('/reports/' + id)
      .then(setReport)
      .catch((e) => toast(e.message));
  }, [id, toast]);
  async function rerun() {
    try {
      await mutate('/reports/' + id + '/reprocess');
      toast('A new processing version was queued. Prior findings are preserved.');
      await refresh();
      onClose();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  return (
    <Modal title={report?.name || 'Report details'} onClose={onClose} wide>
      {report && (
        <>
          <div className="report-meta">
            <Badge value={report.status} />
            <span>FY{report.year}</span>
            <span>{report.page_count} pages</span>
            <span>{report.chunk_count} passages</span>
            <span>{report.boundary}</span>
          </div>
          {report.warning && <div className="callout warning">{report.warning}</div>}
          <div className="button-row">
            <SourceLink reportId={id} label="Open original report" />
            <ExportReport
              url="/api/export"
              query={'reportId=' + encodeURIComponent(id)}
              label="Export findings"
            />
            <button
              className="button secondary"
              disabled={user?.role === 'reviewer'}
              title={
                user?.role === 'reviewer' ? 'An owner or analyst can reprocess reports' : undefined
              }
              onClick={rerun}
            >
              Process a new version
            </button>
          </div>
          <div className="detail-columns">
            <section>
              <h3>Source pages</h3>
              <div className="page-list">
                {report.pages.map((p: Item) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      api('/reports/' + id + '/pages/' + p.number)
                        .then(setPage)
                        .catch((e) => toast(e.message))
                    }
                  >
                    <BookOpen size={17} />
                    <span>
                      Source {p.number}
                      <small>
                        {p.text_length} characters · {p.tables.length} tables {p.ocr ? '· OCR' : ''}
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            </section>
            <section>
              {page ? (
                <>
                  <h3>Source {page.number}</h3>
                  <pre className="source-text">{page.text}</pre>
                  {page.tables.length > 0 && (
                    <details>
                      <summary>Extracted tables</summary>
                      <pre className="source-text">{JSON.stringify(page.tables, null, 2)}</pre>
                    </details>
                  )}
                </>
              ) : (
                <Empty title="Inspect the original context">
                  Select a source page to read its text and extracted tables.
                </Empty>
              )}
            </section>
          </div>
          <h3>Extracted claims</h3>
          <div className="simple-list">
            {report.claims.map((c: Item) => (
              <button
                key={c.id}
                onClick={() => {
                  onClose();
                  openClaim(c.id);
                }}
              >
                <span>
                  <b>{c.text}</b>
                  <small>
                    FY{c.year} · {c.method}
                  </small>
                </span>
                <Badge value={c.status} />
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
export function Reports() {
  const { data, user, toast, refresh } = useWorkspace();
  const [upload, setUpload] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const list = data.reports.filter((r: Item) =>
    (r.name + ' ' + r.year).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="REPORT LIBRARY"
        title="Your evidence starts here."
        description="Upload source reports, track processing and inspect every passage behind the findings."
        action={
          user?.role !== 'reviewer' && (
            <button className="button primary" onClick={() => setUpload(true)}>
              <Plus size={17} />
              Add report
            </button>
          )
        }
      />
      <Jobs jobs={data.jobs} />
      <Panel
        title="Reports"
        action={
          <label className="search-field">
            <ScanSearch size={17} />
            <input
              placeholder="Search reports"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        }
      >
        {list.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>REPORT</th>
                  <th>PERIOD / SCOPE</th>
                  <th>PROCESSING</th>
                  <th>CLAIMS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r: Item) => (
                  <tr key={r.id}>
                    <td>
                      <div className="table-title">
                        <FileText size={20} />
                        <span>
                          <b>{r.name}</b>
                          <small>{date(r.created_at)}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <b>FY{r.year}</b>
                      <small className="block muted">{r.boundary}</small>
                    </td>
                    <td>
                      <Badge value={r.status} />
                      <small className="block muted">
                        {r.mode === 'pending'
                          ? 'Processing'
                          : r.mode === 'hosted-rag' || r.mode === 'local-rag'
                            ? r.mode === 'local-rag'
                              ? 'Local AI'
                              : 'Hosted RAG'
                            : 'Keyword baseline'}
                      </small>
                    </td>
                    <td>{r.claim_count}</td>
                    <td>
                      <button className="button small secondary" onClick={() => setSelected(r.id)}>
                        Open
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={search ? 'No matching reports' : 'Build your report library'}
            action={
              !search &&
              user?.role !== 'reviewer' && (
                <button className="button primary" onClick={() => setUpload(true)}>
                  <Upload size={16} />
                  Upload a report
                </button>
              )
            }
          >
            Use a text-based PDF for physical page citations. Scanned pages are flagged when OCR is
            unavailable.
          </Empty>
        )}
      </Panel>
      {upload && <UploadReport onClose={() => setUpload(false)} />}{' '}
      {selected && <ReportDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
export function Claims() {
  const { data, openClaim } = useWorkspace();
  const [search, setSearch] = useState(''),
    [state, setState] = useState(''),
    [goal, setGoal] = useState(''),
    [report, setReport] = useState('');
  const list = data.claims.filter(
    (c: Item) =>
      (!search || c.text.toLowerCase().includes(search.toLowerCase())) &&
      (!state || c.status === state) &&
      (!goal || c.sdgs.includes(Number(goal))) &&
      (!report || c.report_id === report),
  );
  return (
    <>
      <Heading
        eyebrow="CLAIMS & SDG MAPPING"
        title="Follow each claim to its source."
        description="Inspect the suggested mapping, matched evidence and deterministic comparison before recording a decision."
        action={
          <div className="button-row">
            <a href="/api/export/csv" className="button secondary">
              <Download size={16} />
              CSV
            </a>
            <a href="/api/export/pdf" className="button primary">
              <Download size={16} />
              Review report
            </a>
          </div>
        }
      />
      <div className="filter-bar">
        <label className="search-field">
          <ScanSearch size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claim text"
          />
        </label>
        <select aria-label="Filter status" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All evidence statuses</option>
          <option value="supported">Supported</option>
          <option value="needs_review">Needs review</option>
          <option value="insufficient_evidence">Insufficient evidence</option>
        </select>
        <select aria-label="Filter goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="">All SDGs</option>
          {data.settings.goals?.map((g: Item) => (
            <option value={g.id} key={g.id}>
              SDG {g.id} · {g.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter report"
          value={report}
          onChange={(e) => setReport(e.target.value)}
        >
          <option value="">All reports</option>
          {data.reports.map((r: Item) => (
            <option value={r.id} key={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <Panel title={list.length + ' claims in this view'}>
        {list.length ? (
          <div className="claim-list">
            {list.map((c: Item) => (
              <button className="claim-card" key={c.id} onClick={() => openClaim(c.id)}>
                <div className="claim-top">
                  <span>
                    <FileText size={14} />
                    {c.report_name} · source {c.page_number}
                  </span>
                  <Badge value={c.status} />
                </div>
                <p>{c.text}</p>
                <div className="claim-bottom">
                  <SdgChips goals={c.sdgs} reference={data.settings.goals} />
                  <span>
                    {c.review_state === 'unreviewed'
                      ? 'Awaiting human review'
                      : label(c.review_state)}
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty title="No claims in this view">
            Upload a report or adjust the filters to inspect extracted claims.
          </Empty>
        )}
      </Panel>
    </>
  );
}
