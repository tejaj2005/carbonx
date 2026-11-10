import React, { useEffect, useState } from 'react';
import {
  Landmark,
  LayoutDashboard,
  Building2,
  FileCheck2,
  ClipboardList,
  Users,
  Activity,
  Globe2,
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  PauseCircle,
  CheckCircle2,
  Menu,
  RefreshCw,
  Download,
  Play,
  LockKeyhole,
  Eye,
} from 'lucide-react';
import { api, mutate, date, label, number, type Item } from '../api';
import { useWorkspace } from '../context';
import { Brand, Heading, Panel, Modal, Field, Badge, Empty } from '../components';
import { ReviewJourney, ReviewExperience } from '../VisualJourney';
const nav = [
  ['government', 'Overview', LayoutDashboard],
  ['gov-registry', 'Company registry', Building2],
  ['gov-submissions', 'Claim submissions', FileCheck2],
  ['gov-actions', 'Cases & actions', ClipboardList],
  ['gov-users', 'User management', Users],
  ['gov-audit', 'Activity log', Activity],
] as const;
type Action = { kind: string; item?: Item };
function AdminForm({ action, close }: { action: Action; close: () => void }) {
  const { data, refresh, toast } = useWorkspace(),
    g = data.government,
    a = action.item;
  const [busy, setBusy] = useState(false);
  const titles: Record<string, string> = {
    company: 'Register a company',
    user: 'Add a company user',
    case: 'Record an oversight action',
    licence: 'Update the CarbonX licence',
    review: 'Review a submitted claim',
    resolve: 'Update case status',
    access: a?.disabled ? 'Restore user access' : 'Disable user access',
    publication: 'Public summary settings',
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (action.kind === 'company') await mutate('/government/companies', b);
      if (action.kind === 'user') await mutate('/government/users', b);
      if (action.kind === 'case') await mutate('/government/actions', b);
      if (action.kind === 'licence')
        await mutate(
          '/government/companies/' + a!.id + '/licence',
          { ...b, expectedStatus: a!.licence_status },
          'PATCH',
        );
      if (action.kind === 'review') await mutate('/government/submissions/' + a!.id, b, 'PATCH');
      if (action.kind === 'resolve') await mutate('/government/actions/' + a!.id, b, 'PATCH');
      if (action.kind === 'access')
        await mutate(
          '/government/users/' + a!.id,
          { disabled: !a!.disabled, note: b.note },
          'PATCH',
        );
      if (action.kind === 'publication')
        await mutate(
          '/government/companies/' + a!.id + '/publication',
          {
            visible: b.visible === 'on',
            environment: b.environment === 'on',
            description: b.description,
          },
          'PATCH',
        );
      await refresh();
      toast('The administrative record has been saved.');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={titles[action.kind] || 'Administrative action'} onClose={close}>
      <form className="form-grid" onSubmit={submit}>
        {action.kind === 'company' && (
          <Field label="Company name">
            <input name="name" required minLength={2} maxLength={120} />
          </Field>
        )}
        {['user', 'case'].includes(action.kind) && (
          <Field label="Company">
            <select name="companyId" required defaultValue={a?.id || ''}>
              <option value="" disabled>
                Select a company
              </option>
              {g.companies.map((c: Item) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {action.kind === 'user' && (
          <>
            <Field label="Full name">
              <input name="name" required minLength={2} />
            </Field>
            <Field
              label="Email address"
              hint={g.demo ? 'Use a synthetic @carbonx.invalid email in this sandbox.' : undefined}
            >
              <input
                name="email"
                type="email"
                required
                placeholder={g.demo ? 'reviewer@carbonx.invalid' : ''}
              />
            </Field>
            <Field label="Initial password" hint="The user can change this after sign-in.">
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Company role">
              <select name="role">
                <option value="owner">Company owner</option>
                <option value="analyst">Company analyst</option>
                <option value="reviewer">Company reviewer</option>
              </select>
            </Field>
          </>
        )}
        {action.kind === 'licence' && (
          <>
            <div className="admin-action-subject">
              <Building2 size={22} />
              <span>
                {a!.name}
                <small>Current status: {label(a!.licence_status)}</small>
              </span>
            </div>
            <Field label="Licence number">
              <input name="number" defaultValue={a!.licence_number || ''} maxLength={60} />
            </Field>
            <Field label="New licence status">
              <select name="status" defaultValue={a!.licence_status}>
                <option value="pending">Pending review</option>
                <option value="active">Active</option>
                <option value="suspended">Suspend licence</option>
                <option value="revoked">Revoke licence</option>
              </select>
            </Field>
            <Field label="Reason for the decision">
              <textarea name="reason" required minLength={10} maxLength={3000} />
            </Field>
            <div className="callout warning">
              Suspended or revoked licences pause company submissions and workspace changes. These
              are CarbonX records; no external government licence is changed.
            </div>
          </>
        )}
        {action.kind === 'case' && (
          <>
            <Field label="Action type">
              <select name="type">
                <option value="request_evidence">Request supporting evidence</option>
                <option value="issue_notice">Issue a notice</option>
                <option value="schedule_inspection">Schedule an inspection</option>
                <option value="record_finding">Record a finding</option>
                <option value="report_incident">Report an incident</option>
              </select>
            </Field>
            <Field label="Case note / reason">
              <textarea name="note" required minLength={10} maxLength={3000} />
            </Field>
            <Field
              label="Optional public notice"
              hint="Only this text will be visible publicly if the company summary is published. Leave empty to keep the case private."
            >
              <textarea name="publicNote" maxLength={1000} />
            </Field>
          </>
        )}
        {action.kind === 'review' && (
          <>
            <blockquote className="admin-claim-quote">{a!.text}</blockquote>
            <p className="muted">
              FY{a!.year} · {a!.source}
            </p>
            <Field label="Review decision">
              <select name="status" defaultValue={a!.status}>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under review</option>
                <option value="accepted">Accept submission</option>
                <option value="follow_up">Request follow-up</option>
                <option value="rejected">Reject submission</option>
              </select>
            </Field>
            <Field label="Reason / company response">
              <textarea name="note" required minLength={10} maxLength={3000} />
            </Field>
            <p className="fine-print">
              This records your administrative review. It does not change the report’s automatic
              evidence comparison or establish independent assurance.
            </p>
          </>
        )}
        {action.kind === 'resolve' && (
          <>
            <p>{a!.note}</p>
            <Field label="Case status">
              <select name="status" defaultValue={a!.status}>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </Field>
            <Field label="Update reason">
              <textarea name="note" required minLength={10} maxLength={3000} />
            </Field>
          </>
        )}
        {action.kind === 'access' && (
          <>
            <div className="admin-action-subject">
              <LockKeyhole size={24} />
              <span>
                {a!.name}
                <small>{a!.email}</small>
              </span>
            </div>
            <p>
              {a!.disabled
                ? 'This user will be able to sign in again.'
                : 'This user will be signed out and blocked from signing in until access is restored.'}
            </p>
            <Field label="Reason for changing access">
              <textarea name="note" required minLength={10} />
            </Field>
          </>
        )}
        {action.kind === 'publication' && (
          <>
            <p className="muted">{a!.name}</p>
            <label className="checkbox">
              <input name="visible" type="checkbox" defaultChecked={Boolean(a!.public_visible)} />
              Publish company summary in the public register
            </label>
            <label className="checkbox">
              <input
                name="environment"
                type="checkbox"
                defaultChecked={Boolean(a!.publish_environment)}
              />
              Include stored environmental summaries
            </label>
            <Field label="Public introduction">
              <textarea name="description" defaultValue={a!.public_description} maxLength={500} />
            </Field>
            <p className="fine-print">
              The public sees company name, licence status, reported usage by scope and submitted
              readings. Accounts, uploaded reports, private notes and exact coordinates stay
              private.
            </p>
          </>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? 'Saving…'
            : action.kind === 'licence'
              ? 'Confirm licence decision'
              : action.kind === 'access'
                ? 'Confirm access change'
                : 'Save record'}
          <CheckCircle2 size={16} />
        </button>
      </form>
    </Modal>
  );
}
function CompanyDetail({
  company,
  onClose,
  onAction,
}: {
  company: Item;
  onClose: () => void;
  onAction: (a: Action) => void;
}) {
  const [data, setData] = useState<Item | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/government/companies/' + company.id)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [company.id]);
  return (
    <Modal title={company.name} onClose={onClose} wide>
      <div className="company-detail-summary">
        <Badge value={company.licence_status} />
        <span>{company.licence_number || 'No licence assigned'}</span>
        {company.is_example === 1 && <span className="example-tag">Synthetic example</span>}
        <button
          className="button secondary"
          onClick={() => onAction({ kind: 'licence', item: company })}
        >
          Manage licence
          <ArrowRight size={15} />
        </button>
      </div>
      <div className="button-row admin-detail-actions">
        <button
          className="button secondary"
          onClick={() => onAction({ kind: 'case', item: company })}
        >
          <ClipboardList size={15} />
          Record action
        </button>
        <button
          className="button secondary"
          onClick={() => onAction({ kind: 'publication', item: company })}
        >
          <Globe2 size={15} />
          Public summary
        </button>
        <button
          className="button secondary"
          onClick={() => onAction({ kind: 'user', item: company })}
        >
          <Users size={15} />
          Add user
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {data ? (
        <>
          <Panel title="Claims extracted from company reports">
            {data.claims.length ? (
              <div className="government-claim-list">
                {data.claims.map((c: Item) => (
                  <article key={c.id}>
                    <div className="row-between">
                      <small>
                        {c.report_name} · page {c.page_number}
                      </small>
                      <Badge value={c.status} />
                    </div>
                    <h3>{c.text}</h3>
                    <p>{JSON.parse(c.reason_json).join(' ')}</p>
                    <a
                      className="text-link"
                      target="_blank"
                      rel="noreferrer"
                      href={
                        '/api/government/companies/' +
                        company.id +
                        '/reports/' +
                        c.report_id +
                        '/file#page=' +
                        c.page_number
                      }
                    >
                      Open protected report
                      <ArrowUpRight size={14} />
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="No extracted report claims yet">
                The company can upload sustainability reports from its own workspace.
              </Empty>
            )}
          </Panel>
          <Panel title="Historical reported usage">
            {data.observations.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>METRIC</th>
                      <th>YEAR</th>
                      <th>VALUE</th>
                      <th>BOUNDARY</th>
                      <th>SOURCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.observations.map((o: Item, i: number) => (
                      <tr key={i}>
                        <td>{label(o.metric)}</td>
                        <td>{o.year}</td>
                        <td>
                          {number(o.value, 2)} {o.unit}
                        </td>
                        <td>{o.boundary}</td>
                        <td>{o.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No historical observations recorded.</p>
            )}
          </Panel>
        </>
      ) : (
        !error && <p className="muted">Loading company evidence…</p>
      )}
    </Modal>
  );
}
export function GovernmentPortal({ view }: { view: string }) {
  const { data, user, refresh, logout, loading, signIn, toast } = useWorkspace(),
    g = data.government;
  const [menu, setMenu] = useState(false),
    [action, setAction] = useState<Action | null>(null),
    [detail, setDetail] = useState<Item | null>(null),
    [walkthrough, setWalkthrough] = useState(false),
    [query, setQuery] = useState('');
  useEffect(() => setMenu(false), [view]);
  const current = nav.find((n) => n[0] === view)?.[1] || 'Overview',
    companies = g.companies.filter((c: Item) => c.name.toLowerCase().includes(query.toLowerCase()));
  async function switchDemo() {
    try {
      signIn(await mutate('/auth/demo-switch', { portal: 'company' }));
      location.hash = 'submissions';
    } catch (e) {
      toast((e as Error).message);
    }
  }
  function openAction(a: Action) {
    setDetail(null);
    setAction(a);
  }
  return (
    <div className="app-shell government-shell">
      <aside className={'sidebar ' + (menu ? 'sidebar-open' : '')}>
        <a href="#government">
          <Brand />
        </a>
        <div className="government-authority">
          <Landmark size={26} />
          <strong>Government Oversight</strong>
          <small>Administrative workspace</small>
        </div>
        <span className="nav-label">OVERSIGHT & ACCOUNTABILITY</span>
        <nav>
          {nav.map(([id, name, Icon]) => (
            <a
              href={'#' + id}
              onClick={() => setMenu(false)}
              key={id}
              className={
                view === id || (id === 'government' && !view.startsWith('gov')) ? 'active' : ''
              }
            >
              <Icon size={18} />
              {name}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="#public" className="government-public-link">
            <Globe2 size={16} />
            View public transparency
            <ArrowUpRight size={14} />
          </a>
          <div className="user">
            <span>{user?.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>Government administrator</small>
            </div>
            <button onClick={logout} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menu && <div className="nav-scrim" onClick={() => setMenu(false)} />}
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={22} />
          </button>
          <span className="breadcrumb">
            Government Oversight <span>/</span>
            <strong>{current}</strong>
          </span>
          <div className="topbar-actions">
            <button
              className="button secondary walkthrough-button"
              onClick={() => setWalkthrough(true)}
            >
              <Play size={14} />
              Review walkthrough
            </button>
            <button
              className="icon-button"
              aria-label="Refresh oversight records"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {g.demo && (
            <div className="example-banner">
              <Eye size={16} />
              <span>
                <b>Government presentation sandbox</b> · Actions affect only this synthetic company.
                No external licences are changed.
              </span>
              <button className="demo-role-switch" onClick={() => void switchDemo()}>
                View this company as company
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!['gov-registry', 'gov-submissions', 'gov-actions', 'gov-users', 'gov-audit'].includes(
            view,
          ) && (
            <>
              <Heading
                eyebrow="GOVERNMENT OVERSIGHT"
                title="A clear view. An accountable decision."
                description="Follow company evidence, manage the review queue and keep every administrative action traceable."
                action={
                  <button className="button primary" onClick={() => setAction({ kind: 'case' })}>
                    <Plus size={16} />
                    Record action
                  </button>
                }
              />
              <div className="metric-grid">
                {[
                  [g.stats.companies || 0, 'Registered companies', Building2],
                  [g.stats.pending || 0, 'Submissions to review', FileCheck2],
                  [g.stats.openCases || 0, 'Open cases', ClipboardList],
                  [g.stats.suspended || 0, 'Suspended licences', PauseCircle],
                ].map(([n, title, I]: any) => (
                  <article className="metric-card" key={title}>
                    <div>
                      <span>{title}</span>
                      <I size={19} />
                    </div>
                    <strong>{n}</strong>
                    <small>Recorded in this oversight workspace</small>
                  </article>
                ))}
              </div>
              <ReviewJourney compact />
              <div className="gov-overview-bottom">
                <Panel
                  title="Companies requiring attention"
                  action={
                    <a className="text-link" href="#gov-registry">
                      Open registry
                      <ArrowUpRight size={14} />
                    </a>
                  }
                >
                  {g.companies
                    .filter((c: Item) => c.submission_count || c.licence_status !== 'active')
                    .slice(0, 5)
                    .map((c: Item) => (
                      <button
                        className="government-company-row"
                        key={c.id}
                        onClick={() => setDetail(c)}
                      >
                        <span className="company-monogram">{c.name.slice(0, 2).toUpperCase()}</span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.submission_count} submissions awaiting review</small>
                        </span>
                        <Badge value={c.licence_status} />
                        <ArrowRight size={17} />
                      </button>
                    ))}
                  {!g.companies.length && (
                    <Empty title="Your registry starts here">
                      Register a company, then create its owner account.
                    </Empty>
                  )}
                </Panel>
                <Panel title="Recent administrative activity">
                  {g.audit.slice(0, 5).map((a: Item) => (
                    <div className="government-event" key={a.id}>
                      <Activity size={16} />
                      <div>
                        <b>{label(a.action.replaceAll('.', ' '))}</b>
                        <small>
                          {a.company_name} · {date(a.created_at)}
                        </small>
                      </div>
                    </div>
                  ))}
                </Panel>
              </div>
            </>
          )}
          {view === 'gov-registry' && (
            <>
              <Heading
                eyebrow="COMPANY REGISTRY"
                title="Manage the organisations you oversee."
                description="Inspect uploaded evidence, update licence records and control public-summary publication."
                action={
                  <div className="button-row">
                    <a className="button secondary" href="/api/government/export">
                      <Download size={16} />
                      Export register
                    </a>
                    <button
                      className="button primary"
                      disabled={g.demo}
                      onClick={() => setAction({ kind: 'company' })}
                    >
                      <Plus size={16} />
                      Register company
                    </button>
                  </div>
                }
              />
              {g.demo && (
                <p className="fine-print">
                  The sandbox is restricted to its existing synthetic company. A provisioned
                  administrator can add real company records.
                </p>
              )}
              <Panel
                title="Registered companies"
                action={
                  <input
                    aria-label="Search government companies"
                    placeholder="Search companies"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                }
              >
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>COMPANY</th>
                        <th>LICENCE</th>
                        <th>REPORTS</th>
                        <th>TO REVIEW</th>
                        <th>PUBLIC</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c: Item) => (
                        <tr key={c.id}>
                          <td>
                            <b>{c.name}</b>
                            <small className="block muted">
                              {c.licence_number || 'No licence assigned'}
                              {c.is_example ? ' · Synthetic example' : ''}
                            </small>
                          </td>
                          <td>
                            <Badge value={c.licence_status} />
                          </td>
                          <td>{c.report_count}</td>
                          <td>{c.submission_count}</td>
                          <td>{c.public_visible ? 'Published' : 'Private'}</td>
                          <td>
                            <button className="button secondary" onClick={() => setDetail(c)}>
                              Manage
                              <ArrowUpRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!companies.length && (
                  <Empty title="No matching companies">Register an organisation to begin.</Empty>
                )}
              </Panel>
            </>
          )}
          {view === 'gov-submissions' && (
            <>
              <Heading
                eyebrow="CLAIM REVIEW QUEUE"
                title="Review the claim and its evidence."
                description="Inspect the company’s supporting report, then record your decision and an understandable reason."
              />
              <Panel title="Company submissions">
                {g.submissions.length ? (
                  <div className="submission-list">
                    {g.submissions.map((s: Item) => (
                      <article key={s.id}>
                        <div className="row-between">
                          <span className="eyebrow">
                            {s.company_name} · FY{s.year}
                          </span>
                          <Badge value={s.status} />
                        </div>
                        <h3>{s.text}</h3>
                        <p className="muted">{s.source}</p>
                        {s.review_note && <p className="review-response">{s.review_note}</p>}
                        <div className="button-row">
                          <button
                            className="button primary"
                            onClick={() => setAction({ kind: 'review', item: s })}
                          >
                            Review submission
                            <ArrowRight size={15} />
                          </button>
                          <button
                            className="button secondary"
                            onClick={() =>
                              setDetail(g.companies.find((c: Item) => c.id === s.company_id))
                            }
                          >
                            Inspect company evidence
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="No submissions awaiting review">
                    Company-submitted claims will appear here.
                  </Empty>
                )}
              </Panel>
            </>
          )}
          {view === 'gov-actions' && (
            <>
              <Heading
                eyebrow="CASES & ADMINISTRATIVE ACTIONS"
                title="Follow up with a clear record."
                description="Record evidence requests, notices, inspections, findings or incidents. Keep private case notes separate from public notices."
                action={
                  <button className="button primary" onClick={() => setAction({ kind: 'case' })}>
                    <Plus size={16} />
                    New action
                  </button>
                }
              />
              <Panel title="Case register">
                {g.actions.length ? (
                  <div className="submission-list">
                    {g.actions.map((a: Item) => (
                      <article key={a.id}>
                        <div className="row-between">
                          <span>
                            <Badge value={a.type} /> <Badge value={a.status} />
                          </span>
                          <small>{date(a.created_at)}</small>
                        </div>
                        <h3>{a.company_name}</h3>
                        <p>{a.note}</p>
                        {a.public_note && (
                          <div className="callout info">
                            <b>Public notice</b>
                            <p>{a.public_note}</p>
                          </div>
                        )}
                        <button
                          className="text-link"
                          onClick={() => setAction({ kind: 'resolve', item: a })}
                        >
                          Update case status
                          <ArrowRight size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty title="No administrative cases recorded">
                    Create a case when a company needs a documented follow-up.
                  </Empty>
                )}
              </Panel>
            </>
          )}
          {view === 'gov-users' && (
            <>
              <Heading
                eyebrow="ROLE-BASED ACCESS"
                title="The right access for the right work."
                description="Create company owners, analysts and reviewers. Disable or restore company user access when required."
                action={
                  <button className="button primary" onClick={() => setAction({ kind: 'user' })}>
                    <Plus size={16} />
                    Add user
                  </button>
                }
              />
              <Panel title="User directory">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>USER</th>
                        <th>COMPANY</th>
                        <th>ROLE</th>
                        <th>ACCESS</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {g.users.map((u: Item) => (
                        <tr key={u.id}>
                          <td>
                            <b>{u.name}</b>
                            <small className="block muted">{u.email}</small>
                          </td>
                          <td>{u.company_name}</td>
                          <td>{u.government ? 'Government administrator' : label(u.role)}</td>
                          <td>
                            <Badge value={u.disabled ? 'disabled' : 'active'} />
                          </td>
                          <td>
                            {!u.government && (
                              <button
                                className="button secondary"
                                onClick={() => setAction({ kind: 'access', item: u })}
                              >
                                {u.disabled ? 'Restore access' : 'Disable access'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="fine-print">
                  Government administrator accounts are provisioned through the protected server
                  setup. Company registration cannot grant government access.
                </p>
              </Panel>
            </>
          )}
          {view === 'gov-audit' && (
            <>
              <Heading
                eyebrow="ADMINISTRATIVE ACTIVITY"
                title="A reason behind every action."
                description="Follow licence changes, case updates, company submissions and account-access decisions."
              />
              <Panel title="Recorded events">
                <div className="audit-list">
                  {g.audit.map((a: Item) => (
                    <article key={a.id}>
                      <span className="audit-icon">
                        <Activity size={17} />
                      </span>
                      <div>
                        <div className="row-between">
                          <strong>{label(a.action.replaceAll('.', ' '))}</strong>
                          <small>{date(a.created_at)}</small>
                        </div>
                        <p>
                          {a.actor || 'Processing service'} · {a.company_name}
                        </p>
                        <details>
                          <summary>Decision details</summary>
                          <pre>{JSON.stringify(JSON.parse(a.metadata_json), null, 2)}</pre>
                        </details>
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
        <footer className="app-footer">
          <span>CARBONX · GOVERNMENT OVERSIGHT</span>
          <span>Administrative application records · no external licensing connection</span>
        </footer>
      </main>
      {action && <AdminForm action={action} close={() => setAction(null)} />}
      {detail && (
        <CompanyDetail company={detail} onClose={() => setDetail(null)} onAction={openAction} />
      )}
      {walkthrough && (
        <Modal title="The CarbonX review journey" wide onClose={() => setWalkthrough(false)}>
          <ReviewExperience />
        </Modal>
      )}
    </div>
  );
}
