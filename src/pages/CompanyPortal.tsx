import { ExportReport } from '../ExportReport';
import React, { useState } from 'react';
import {
  Building2,
  FilePlus2,
  Radio,
  Globe2,
  ShieldCheck,
  Plus,
  Send,
  ExternalLink,
  Lock,
  Eye,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { mutate, label, date, number, type Item } from '../api';
import { useWorkspace } from '../context';
import { UsageTrend } from '../UsageTrend';
import { Heading, Panel, Empty, Badge, Field, Modal } from '../components';
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
function SubmissionForm({ close }: { close: () => void }) {
  const { toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('/company/submissions', Object.fromEntries(new FormData(e.currentTarget)));
      await refresh();
      toast('Your claim has been sent to Government Oversight.');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Submit a sustainability claim" onClose={close}>
      <p className="modal-intro">
        Describe the claim and reference the evidence already uploaded to your report library. An
        officer will review the submission.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Your claim">
          <textarea
            name="text"
            required
            minLength={30}
            maxLength={5000}
            placeholder="Describe the achievement, its reporting year and boundary…"
          />
        </Field>
        <Field label="Reporting year">
          <input
            name="year"
            type="number"
            min={1990}
            max={2100}
            required
            defaultValue={new Date().getFullYear() - 1}
          />
        </Field>
        <Field label="Supporting evidence">
          <textarea
            name="source"
            required
            minLength={3}
            maxLength={500}
            placeholder="Report name, page and any supporting record references"
          />
        </Field>
        <button className="button primary" disabled={busy}>
          <Send size={16} />
          {busy ? 'Submitting…' : 'Submit for government review'}
        </button>
      </form>
    </Modal>
  );
}
function ReadingForm({ close }: { close: () => void }) {
  const { data, toast, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await mutate('/company/readings', {
        ...b,
        facilityId: b.facilityId || null,
        recordedAt: new Date(String(b.recordedAt)).toISOString(),
      });
      await refresh();
      toast('Usage reading recorded. Published summaries will refresh automatically.');
      close();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return (
    <Modal title="Record a usage reading" onClose={close}>
      <p className="modal-intro">
        Enter an observed value from a meter or reporting system. This records your submitted
        reading; it does not simulate a connected meter.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Measurement">
          <select name="metric">
            {metrics.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Observed value">
            <input name="value" type="number" min={0} step="any" required />
          </Field>
          <Field label="Unit">
            <input name="unit" required placeholder="kL, MWh, tCO2e…" />
          </Field>
        </div>
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
        <Field label="Observation time">
          <input name="recordedAt" type="datetime-local" required defaultValue={local} />
        </Field>
        <Field label="Source of the reading">
          <input
            name="source"
            required
            minLength={3}
            maxLength={500}
            placeholder="Meter ID or reporting-system reference"
          />
        </Field>
        <button className="button primary" disabled={busy}>
          <Radio size={16} />
          {busy ? 'Saving…' : 'Save observed reading'}
        </button>
      </form>
    </Modal>
  );
}
function Publication() {
  const { data, user, refresh, toast } = useWorkspace(),
    r = data.company.registry;
  const [visible, setVisible] = useState(Boolean(r.public_visible)),
    [environment, setEnvironment] = useState(Boolean(r.publish_environment)),
    [description, setDescription] = useState(r.public_description || ''),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('/company/publication', { visible, environment, description }, 'PATCH');
      await refresh();
      toast(
        visible
          ? 'Your selected summary is public.'
          : 'Your summary is now hidden from public access.',
      );
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Your public transparency page"
      kicker="CONTROL WHAT YOU SHARE"
      action={
        <a href="#public" className="text-link">
          <Eye size={15} />
          View public register
          <ExternalLink size={14} />
        </a>
      }
    >
      <form className="form-grid" onSubmit={save}>
        <label className="publication-toggle">
          <span>
            <Globe2 size={22} />
            <span>
              <b>Publish company summary</b>
              <small>
                Company name, licence status, reported usage by scope and recent readings become
                publicly accessible.
              </small>
            </span>
          </span>
          <input
            type="checkbox"
            checked={visible}
            disabled={user?.role !== 'owner'}
            onChange={(e) => setVisible(e.target.checked)}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={environment}
            disabled={user?.role !== 'owner'}
            onChange={(e) => setEnvironment(e.target.checked)}
          />
          Also share stored regional air-quality and satellite index summaries
        </label>
        <Field label="Public introduction">
          <textarea
            value={description}
            maxLength={500}
            disabled={user?.role !== 'owner'}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short introduction for public visitors"
          />
        </Field>
        <p className="fine-print">
          <Lock size={13} /> Report files, source passages, private reviewer notes, account details
          and exact site coordinates are excluded. Environmental observations retain their recorded
          times.
        </p>
        {user?.role === 'owner' && (
          <button
            className="button secondary"
            disabled={busy || ['suspended', 'revoked'].includes(r.licence_status)}
          >
            {busy ? 'Saving…' : 'Save publication choices'}
          </button>
        )}
      </form>
    </Panel>
  );
}
export function CompanyPortal() {
  const { data, user } = useWorkspace(),
    c = data.company,
    r = c.registry;
  const [modal, setModal] = useState<'claim' | 'reading' | null>(null),
    paused = ['suspended', 'revoked'].includes(r.licence_status),
    canSubmit = user?.role !== 'reviewer' && !paused;
  return (
    <>
      <Heading
        eyebrow="COMPANY SUBMISSIONS"
        title="Make your claim. Show your evidence."
        description="Send claims to Government Oversight, record usage and choose what the public can see."
        action={
          <div className="button-row">
            <ExportReport url="/api/company/export" label="Export company report" />
            <button
              className="button primary"
              disabled={!canSubmit}
              onClick={() => setModal('claim')}
            >
              <FilePlus2 size={16} />
              Submit a claim
            </button>
          </div>
        }
      />
      <section className={'licence-banner ' + (paused ? 'licence-paused' : '')}>
        <span className="licence-symbol">
          <ShieldCheck size={27} />
        </span>
        <div>
          <span className="eyebrow">CARBONX LICENCE RECORD</span>
          <h2>{r.licence_number || 'Awaiting licence assignment'}</h2>
          <p>
            {paused
              ? 'Submissions and changes are paused. Your existing evidence remains available to read.'
              : 'Your company’s administrative status is visible here. Review any follow-up requests below.'}
          </p>
        </div>
        <Badge value={r.licence_status} />
      </section>
      {r.licence_reason && (
        <div className="callout info">
          <b>Government Oversight note</b>
          <p>{r.licence_reason}</p>
        </div>
      )}
      <div className="submission-summary">
        <div>
          <span>Claims submitted</span>
          <strong>{c.submissions.length}</strong>
        </div>
        <div>
          <span>Awaiting a decision</span>
          <strong>
            {
              c.submissions.filter((s: Item) =>
                ['submitted', 'under_review', 'follow_up'].includes(s.status),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Usage readings</span>
          <strong>{c.readings.length}</strong>
        </div>
        <div>
          <span>Public summary</span>
          <strong>{r.public_visible ? 'Published' : 'Private'}</strong>
        </div>
      </div>
      <Panel title="Your submitted claims">
        {c.submissions.length ? (
          <div className="submission-list">
            {c.submissions.map((s: Item) => (
              <article key={s.id}>
                <div className="row-between">
                  <span className="eyebrow">
                    FY{s.year} · {date(s.created_at)}
                  </span>
                  <Badge value={s.status} />
                </div>
                <h3>{s.text}</h3>
                <p className="muted">{s.source}</p>
                {s.review_note && (
                  <div className="review-response">
                    <ShieldCheck size={17} />
                    <span>
                      <b>Government review</b>
                      {s.review_note}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="Ready for your first submission"
            action={
              <a href="#reports" className="button secondary">
                Upload supporting reports
                <ArrowRight size={15} />
              </a>
            }
          >
            Upload a source report, then submit the claim and its evidence reference.
          </Empty>
        )}
      </Panel>
      <Panel
        title="Usage readings"
        kicker="OBSERVED VALUES"
        action={
          <button
            className="button secondary"
            disabled={!canSubmit}
            onClick={() => setModal('reading')}
          >
            <Plus size={15} />
            Record reading
          </button>
        }
      >
        {c.readings.length ? (
          <>
            <UsageTrend readings={c.readings} synthetic={user?.isExample} />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MEASUREMENT</th>
                    <th>OBSERVED VALUE</th>
                    <th>TIME</th>
                    <th>SOURCE</th>
                  </tr>
                </thead>
                <tbody>
                  {c.readings.slice(0, 10).map((m: Item) => (
                    <tr key={m.id}>
                      <td>{label(m.metric)}</td>
                      <td>
                        <b>
                          {number(m.value, 2)} {m.unit}
                        </b>
                      </td>
                      <td>{date(m.recorded_at)}</td>
                      <td>{m.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Empty title="Keep recent usage visible">
            Record actual meter or reporting-system observations. Published readings appear on the
            public page after its next refresh.
          </Empty>
        )}
        <p className="chart-note">
          {user?.isExample
            ? 'Synthetic monthly totals are included for presentation. Dates show period endings; these are not live sensor readings.'
            : 'Continuous meter telemetry is not connected. Every value here is a company-submitted observation.'}
        </p>
      </Panel>
      <Publication key={r.updated_at} />
      <Panel title="Government requests & actions">
        {c.actions.length ? (
          <div className="submission-list">
            {c.actions.map((a: Item) => (
              <article key={a.id}>
                <div className="row-between">
                  <Badge value={a.type} />
                  <Badge value={a.status} />
                </div>
                <p>{a.note}</p>
                <small className="muted">{date(a.created_at)}</small>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No follow-up requests">
            Any evidence requests, notices or administrative actions will appear here.
          </Empty>
        )}
      </Panel>
      {modal === 'claim' && <SubmissionForm close={() => setModal(null)} />}
      {modal === 'reading' && <ReadingForm close={() => setModal(null)} />}
    </>
  );
}
