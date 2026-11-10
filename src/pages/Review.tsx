import { ProfileSettings } from '../ProfileSettings';
import React, { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  Download,
  Settings,
  ShieldCheck,
  Plus,
  Sparkles,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { mutate, label, date, number, type Item } from '../api';
import { useWorkspace } from '../context';
import { Heading, Panel, Empty, Badge, Modal, Field, SdgChips } from '../components';
export function Recommendations() {
  const { data, user, toast, refresh, openClaim } = useWorkspace();
  const [filter, setFilter] = useState(''),
    [busy, setBusy] = useState(false);
  async function update(id: string, status: string) {
    try {
      await mutate('/recommendations/' + id, { status }, 'PATCH');
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function generate() {
    setBusy(true);
    try {
      await mutate('/recommendations/generate');
      await refresh();
      toast('AI-assisted actions generated from the cited findings.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const items = data.recommendations.filter((r: Item) => !filter || r.status === filter);
  return (
    <>
      <Heading
        eyebrow="GAPS & ACTION PLANS"
        title="Turn findings into follow-through."
        description="Prioritise evidence gaps, resolve discrepancies and keep action ownership visible."
        action={
          !data.settings.providers.hostedAI?.configured ? (
            <a className="button secondary" href="#settings">
              Set up AI
            </a>
          ) : (
            <button
              className="button secondary"
              disabled={
                busy || !data.settings.providers.hostedAI?.configured || user?.role === 'analyst'
              }
              onClick={() => void generate()}
            >
              <Sparkles size={16} />
              {busy ? 'Generating…' : 'AI-assisted action plan'}
            </button>
          )
        }
      />
      <div className="scope-note">
        <ShieldCheck size={17} />
        <span>
          Actions are grounded in recorded findings. Confirm suitability and document evidence
          before marking an item complete.
        </span>
      </div>
      <Panel
        title={items.length + ' action items'}
        action={
          <select
            value={filter}
            aria-label="Filter actions"
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All actions</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        }
      >
        {items.length ? (
          <div className="recommendation-list">
            {items.map((r: Item) => (
              <article key={r.id}>
                <div className="recommendation-header">
                  <Badge value={r.priority} />
                  <span>
                    {r.status === 'done' ? <CheckCircle2 size={16} /> : null}
                    {label(r.status)}
                  </span>
                </div>
                <h3>{r.title}</h3>
                <p>{r.action}</p>
                <button className="linked-claim" onClick={() => openClaim(r.claim_id)}>
                  {r.claim_text}
                  <ArrowUpRight size={17} />
                </button>
                <div className="row-between">
                  <SdgChips
                    goals={JSON.parse(r.sdgs_json || '[]')}
                    reference={data.settings.goals}
                  />
                  {user?.role !== 'analyst' && (
                    <select
                      aria-label="Action status"
                      value={r.status}
                      onChange={(e) => void update(r.id, e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No action items yet">
            Actions appear after report processing and historical comparison.
          </Empty>
        )}
      </Panel>
    </>
  );
}
export function Evaluation() {
  const { data, user, toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const e = data.evaluations,
    latest = e.runs[0]?.metrics;
  async function run() {
    setBusy(true);
    try {
      await mutate('/evaluations/run');
      await refresh();
      toast('Evaluation completed against the workspace test labels.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="MEASURED EVALUATION"
        title="Measure the pipeline you actually ran."
        description="Compare keyword mapping with the stored pipeline output against independently reviewed labels."
        action={
          <button
            className="button primary"
            disabled={
              busy || user?.role === 'analyst' || !e.cases.some((c: Item) => c.split === 'test')
            }
            title={
              user?.role === 'analyst'
                ? 'A reviewer or owner runs evaluation'
                : !e.cases.some((c: Item) => c.split === 'test')
                  ? 'Add independent held-out test labels from claim reviews first'
                  : undefined
            }
            onClick={() => void run()}
          >
            <FlaskConical size={16} />
            {busy ? 'Evaluating…' : 'Run held-out evaluation'}
          </button>
        }
      />
      <div className="metric-grid three">
        <article className="metric-card">
          <div>
            <span>Human labels</span>
            <FlaskConical size={18} />
          </div>
          <strong>{e.cases.length}</strong>
          <small>Stored reference decisions</small>
        </article>
        <article className="metric-card">
          <div>
            <span>Held-out test cases</span>
            <ShieldCheck size={18} />
          </div>
          <strong>{e.cases.filter((c: Item) => c.split === 'test').length}</strong>
          <small>Development labels excluded</small>
        </article>
        <article className="metric-card">
          <div>
            <span>Evaluation runs</span>
            <Activity size={18} />
          </div>
          <strong>{e.runs.length}</strong>
          <small>Recorded measurements</small>
        </article>
      </div>
      {latest ? (
        <>
          <Panel title="Latest measured results" kicker={date(latest.evaluatedAt)}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MEASURE</th>
                    <th>PRECISION</th>
                    <th>RECALL</th>
                    <th>F1</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Keyword baseline SDG mapping', latest.baselineMapping],
                    ['Stored pipeline SDG mapping', latest.pipelineMapping],
                  ].map(([name, m]: any) => (
                    <tr key={name}>
                      <td>
                        <b>{name}</b>
                      </td>
                      <td>{number(m.precision * 100, 1)}%</td>
                      <td>{number(m.recall * 100, 1)}%</td>
                      <td>{number(m.f1 * 100, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="delta-strip">
              <span>
                Status accuracy <b>{number(latest.claimStatus.accuracy * 100, 1)}%</b>
              </span>
              <span>
                Status macro F1 <b>{number(latest.claimStatus.macroF1 * 100, 1)}%</b>
              </span>
              <span>
                Lexical Recall@5{' '}
                <b>
                  {latest.lexicalRecallAt5 === null
                    ? 'Not labelled'
                    : number(latest.lexicalRecallAt5 * 100, 1) + '%'}
                </b>
              </span>
            </div>
            <p className="chart-note">{latest.note}</p>
          </Panel>
          <Panel title="Claim-status confusion matrix">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ACTUAL / PREDICTED</th>
                    {latest.claimStatus.perLabel.map((x: Item) => (
                      <th key={x.label}>{label(x.label)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latest.claimStatus.matrix.map((r: Item) => (
                    <tr key={r.actual}>
                      <td>
                        <b>{label(r.actual)}</b>
                      </td>
                      {latest.claimStatus.perLabel.map((x: Item) => (
                        <td key={x.label}>{r[x.label] || 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : (
        <Panel title="Build a reproducible evaluation">
          <Empty
            title="No benchmark numbers are assumed"
            action={
              <a className="button secondary" href="#claims">
                Label a claim
                <ArrowRight size={15} />
              </a>
            }
          >
            Open a claim, inspect its source and comparison, then add an independent evaluation
            label. Reported scores in the implementation review are not treated as measurements from
            this application.
          </Empty>
        </Panel>
      )}
      <Panel title="Labelled cases">
        {e.cases.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>CLAIM</th>
                  <th>EXPECTED STATUS</th>
                  <th>SPLIT</th>
                  <th>EXPECTED SDGS</th>
                </tr>
              </thead>
              <tbody>
                {e.cases.map((c: Item) => (
                  <tr key={c.id}>
                    <td className="wrap-cell">{c.text}</td>
                    <td>
                      <Badge value={c.expected_status} />
                    </td>
                    <td>{c.split}</td>
                    <td>{c.expected_sdgs.join(', ') || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No human labels recorded.</p>
        )}
      </Panel>
    </>
  );
}
export function Audit() {
  const { data, openClaim } = useWorkspace();
  return (
    <>
      <Heading
        eyebrow="ACTIVITY LOG"
        title="A record you can follow."
        description="Uploads, processing modes, field corrections, exports and reviewer decisions stay attributable."
      />
      <Panel title="Workspace events">
        {data.audit.length ? (
          <div className="audit-list">
            {data.audit.map((a: Item) => (
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
                    {a.actor || 'Processing service'} · {a.entity}
                  </p>
                  {a.entity === 'claim' && (
                    <button className="text-link" onClick={() => openClaim(a.entity_id)}>
                      Open claim
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                  <details>
                    <summary>Event details</summary>
                    <pre>{JSON.stringify(JSON.parse(a.metadata_json), null, 2)}</pre>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No events yet">Recorded workspace actions will appear here.</Empty>
        )}
      </Panel>
    </>
  );
}
function TeamMember({ onClose }: { onClose: () => void }) {
  const { toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('/team', Object.fromEntries(new FormData(e.currentTarget)));
      toast('Team member added to this company workspace.');
      await refresh();
      onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add a team member" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Name">
          <input name="name" required minLength={2} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required />
        </Field>
        <Field
          label="Initial password"
          hint="Share this outside CarbonX through your approved channel."
        >
          <input
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </Field>
        <Field label="Role">
          <select name="role">
            <option value="analyst">Analyst · reports and historical data</option>
            <option value="reviewer">Reviewer · decisions and labels</option>
          </select>
        </Field>
        <button className="button primary" disabled={busy}>
          Add to workspace
        </button>
      </form>
    </Modal>
  );
}
function PasswordForm() {
  const { toast } = useWorkspace();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      values = Object.fromEntries(new FormData(form));
    if (values.newPassword !== values.confirmPassword) {
      toast('New passwords must match.');
      return;
    }
    setBusy(true);
    try {
      await mutate('/auth/password', values);
      form.reset();
      toast('Password changed. Other sessions have been signed out.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel title="Your password">
      <form className="form-grid" onSubmit={submit}>
        <Field label="Current password">
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            maxLength={128}
          />
        </Field>
        <div className="two-fields">
          <Field label="New password">
            <input
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
            />
          </Field>
        </div>
        <button className="button secondary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </Panel>
  );
}
export function SettingsPage() {
  const { data, user } = useWorkspace();
  const [team, setTeam] = useState(false);
  const p = data.settings.providers;
  return (
    <>
      <Heading
        eyebrow="WORKSPACE SETTINGS"
        title="Clear configuration. Controlled access."
        description="Check the active processing mode, provider setup and company team."
      />
      <ProfileSettings />
      <Panel title="India reference data">
        <p className="muted">{data.settings.referenceData?.notice}</p>
        <div className="provider-list">
          {(data.settings.referenceData?.records || []).map((r: Item) => (
            <div key={r.id}>
              <span>
                <b>
                  {r.organization} · {r.period}
                </b>
                <small>
                  {r.metric}: {r.value}
                  {r.unit} · {r.boundary}
                </small>
              </span>
              <a className="text-link" href={r.sourceUrl} target="_blank" rel="noreferrer">
                Source <ArrowUpRight size={14} />
              </a>
            </div>
          ))}
        </div>
        <p className="fine-print">{data.settings.referenceData?.comparison.interpretation}</p>
      </Panel>
      <div className="settings-columns">
        <Panel title="Processing & provider status">
          <div className="provider-list">
            <div>
              <span>
                <b>AI report analysis</b>
                <small>
                  {p.hostedAI?.configured ? p.hostedAI.model : 'Keyword baseline is active'}
                </small>
              </span>
              <Badge value={p.hostedAI?.configured ? 'configured' : 'not_configured'} />
            </div>
            <div>
              <span>
                <b>PDF text & table extraction</b>
                <small>Page references and token-based passage splitting</small>
              </span>
              <Badge value="available" />
            </div>
            <div>
              <span>
                <b>Scanned PDF OCR</b>
                <small>Local English OCR, when enabled</small>
              </span>
              <Badge value={p.ocr?.enabled ? 'enabled' : 'disabled'} />
            </div>
            <div>
              <span>
                <b>Atmospheric context</b>
                <small>Open-Meteo weather and air quality</small>
              </span>
              <Badge value="adapter_available" />
            </div>
            <div>
              <span>
                <b>Satellite imagery</b>
                <small>{p.satellite.provider} · NDVI / NDWI</small>
              </span>
              <Badge value={p.satellite.configured ? 'adapter_available' : 'not_configured'} />
            </div>
            <div>
              <span>
                <b>Persistent storage</b>
                <small>{data.settings.storage}</small>
              </span>
              <Badge value="available" />
            </div>
          </div>
          <p className="chart-note">
            Adapter availability means the connector is implemented. A provider request records its
            actual availability separately.
          </p>
        </Panel>
      </div>
      <Panel
        title="Facilities"
        action={
          <a href="#environment" className="text-link">
            Manage sites
            <ArrowUpRight size={14} />
          </a>
        }
      >
        {data.facilities.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>FACILITY</th>
                  <th>BOUNDARY</th>
                  <th>COORDINATES</th>
                  <th>ID FOR CSV IMPORTS</th>
                </tr>
              </thead>
              <tbody>
                {data.facilities.map((f: Item) => (
                  <tr key={f.id}>
                    <td>
                      <b>{f.name}</b>
                    </td>
                    <td>{f.boundary}</td>
                    <td>
                      {f.latitude}, {f.longitude}
                    </td>
                    <td>
                      <code>{f.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No facilities recorded.</p>
        )}
      </Panel>
      {user?.role === 'owner' && (
        <Panel
          title="Company team"
          action={
            <button className="button secondary" onClick={() => setTeam(true)}>
              <Plus size={15} />
              Add member
            </button>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th>ROLE</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map((u: Item) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <Badge value={u.role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <PasswordForm />
      {team && <TeamMember onClose={() => setTeam(false)} />}
    </>
  );
}
