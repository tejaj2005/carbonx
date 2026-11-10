import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, ArrowUpRight, ShieldCheck, Save, Download, ClipboardCheck } from 'lucide-react';
import { api, mutate, label, number, date, type Item } from './api';
import { useWorkspace } from './context';
import { Modal, Field, Badge, SdgChips, SourceLink, Empty, Spinner } from './components';
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
export function ClaimDetail() {
  const { claimId, closeClaim, data, user, toast, refresh } = useWorkspace(),
    [claim, setClaim] = useState<Item | null>(null),
    [tab, setTab] = useState('evidence'),
    [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      api('/claims/' + claimId)
        .then(setClaim)
        .catch((e) => toast(e.message)),
    [claimId, toast],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const canReview = user?.role !== 'analyst';
  async function review(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate(
        '/claims/' + claimId + '/review',
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      toast('Review decision recorded with your rationale.');
      await load();
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function correct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget)),
      num = (key: string) => (form[key] === '' ? null : Number(form[key]));
    setBusy(true);
    try {
      await mutate(
        '/claims/' + claimId,
        {
          metric: form.metric || null,
          value: num('value'),
          unit: form.unit || null,
          year: num('year'),
          baseline_year: num('baseline_year'),
          boundary: form.boundary,
          facility_id: form.facility_id || null,
          claimed_change: num('claimed_change'),
          direction: form.direction || null,
          sdgs: String(form.sdgs)
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
            .map(Number),
          rationale: form.rationale,
        },
        'PATCH',
      );
      toast('Claim fields corrected. Evidence comparison recalculated.');
      await load();
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function annotate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await mutate('/evaluations/labels', {
        claimId,
        expectedStatus: form.get('expectedStatus'),
        expectedSdgs: String(form.get('goals'))
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
          .map(Number),
        relevantChunkIds: form.getAll('chunks'),
        split: form.get('split'),
      });
      toast('Human evaluation label saved.');
      await refresh();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Claim evidence & review" onClose={closeClaim} wide>
      {!claim ? (
        <Spinner />
      ) : (
        <>
          <div className="claim-detail-summary">
            <Badge value={claim.status} />
            <SdgChips goals={claim.sdgs} reference={data.settings.goals} />
            <span className="muted">
              {claim.method.startsWith('hosted')
                ? 'Hosted RAG extraction'
                : 'Keyword baseline extraction'}
            </span>
            <h2>{claim.text}</h2>
            <p>{claim.rationale}</p>
          </div>
          <div className="tabs" role="tablist">
            {[
              ['evidence', 'Source & passages'],
              ['comparison', 'Historical comparison'],
              ['review', 'Review & correct'],
              ['label', 'Evaluation label'],
            ]
              .filter((x) => canReview || !['review', 'label'].includes(x[0]))
              .map(([id, name]) => (
                <button
                  key={id}
                  className={tab === id ? 'active' : ''}
                  onClick={() => setTab(id)}
                  role="tab"
                  aria-selected={tab === id}
                >
                  {name}
                </button>
              ))}
          </div>
          {tab === 'evidence' && (
            <div className="evidence-detail">
              <div className="row-between">
                <span>
                  <BookOpen size={15} /> {claim.source.report_name} · source{' '}
                  {claim.source.page_number}
                </span>
                <SourceLink reportId={claim.report_id} page={claim.source.page_number} />
              </div>
              <blockquote className="source-quote">{claim.text}</blockquote>
              <details>
                <summary>Read the complete source page</summary>
                <pre className="source-text">{claim.source.page_text}</pre>
              </details>
              {claim.source.tables.length > 0 && (
                <details>
                  <summary>{claim.source.tables.length} extracted tables</summary>
                  <pre className="source-text">{JSON.stringify(claim.source.tables, null, 2)}</pre>
                </details>
              )}
              <h3>Related evidence passages</h3>
              <div className="related-passages">
                {claim.retrieved.map((p: Item) => (
                  <article key={p.id}>
                    <div className="row-between">
                      <strong>
                        {p.report_name} · source {p.page_number}
                      </strong>
                      <SourceLink reportId={p.report_id} page={p.page_number} />
                    </div>
                    <p>{p.text}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
          {tab === 'comparison' && (
            <>
              <div className="callout info">
                <b>Comparison rule</b>
                <p>
                  Match the metric, canonical unit, reporting years, facility and boundary first.
                  Percentage-change claims are flagged when the discrepancy exceeds 2 percentage
                  points. Direct values use a 0.5% rounding tolerance.
                </p>
              </div>
              <div className="scope-grid">
                <div>
                  <small>Metric</small>
                  <strong>{label(claim.metric)}</strong>
                </div>
                <div>
                  <small>Reporting boundary</small>
                  <strong>{claim.boundary || 'Missing'}</strong>
                </div>
                <div>
                  <small>Reporting year</small>
                  <strong>{claim.year || 'Missing'}</strong>
                </div>
                <div>
                  <small>Baseline year</small>
                  <strong>{claim.baseline_year || 'Missing'}</strong>
                </div>
              </div>
              <div className="comparison-grid">
                {['baseline', 'current'].map((key) => (
                  <article key={key}>
                    <span className="eyebrow">
                      {key === 'baseline' ? 'BASELINE RECORD' : 'CURRENT RECORD'}
                    </span>
                    {claim.comparison[key] ? (
                      <>
                        <strong>
                          {number(claim.comparison[key].value, 2)}{' '}
                          <small>{claim.comparison[key].unit}</small>
                        </strong>
                        <b>FY{claim.comparison[key].year}</b>
                        <p>{claim.comparison[key].source}</p>
                      </>
                    ) : (
                      <Empty title="Evidence not matched">
                        Add a unique observation with the same unit, facility and reporting
                        boundary.
                      </Empty>
                    )}
                  </article>
                ))}
              </div>
              {claim.comparison.computedChange !== undefined && (
                <div className="delta-strip">
                  <span>
                    Claimed change <b>{number(claim.comparison.claimedChange, 2)}%</b>
                  </span>
                  <span>
                    Computed change <b>{number(claim.comparison.computedChange, 2)}%</b>
                  </span>
                  <span>
                    Difference <b>{number(claim.comparison.differencePercentagePoints, 2)} pp</b>
                  </span>
                </div>
              )}
              <div className={'callout ' + (claim.status === 'supported' ? 'success' : 'warning')}>
                <b>{label(claim.status)}</b>
                {claim.reasons.map((reason: string) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
              <p className="fine-print">
                “Supported” means consistency with the recorded observations. Independent assurance
                and a reviewer’s judgment remain separate.
              </p>
            </>
          )}
          {tab === 'review' && (
            <div className="review-forms">
              <section>
                <h3>Record your review</h3>
                <p className="muted">
                  Current human outcome: <b>{label(claim.review_state)}</b>
                </p>
                <form className="form-grid" onSubmit={review}>
                  <Field label="Review outcome">
                    <select name="decision" required>
                      <option value="follow_up">Request follow-up</option>
                      <option value="accepted">Accept the evidence review</option>
                      <option value="rejected">Reject the reported claim</option>
                    </select>
                  </Field>
                  <Field label="Reviewer rationale">
                    <textarea
                      name="rationale"
                      required
                      minLength={10}
                      maxLength={3000}
                      placeholder="Explain the evidence and the reason for your decision."
                    />
                  </Field>
                  <button className="button primary" disabled={busy}>
                    <ShieldCheck size={16} />
                    Record decision
                  </button>
                </form>
                <div className="review-history">
                  {claim.reviews.map((r: Item) => (
                    <article key={r.id}>
                      <Badge value={r.decision} />
                      <p>{r.rationale}</p>
                      <small>
                        {r.reviewer} · {date(r.created_at)}
                      </small>
                    </article>
                  ))}
                </div>
              </section>
              <section>
                <h3>Correct extracted fields</h3>
                <p className="fine-print">
                  Check the source before changing these values. Corrections recalculate status and
                  return the claim to unreviewed.
                </p>
                <form className="form-grid" onSubmit={correct} key={claim.id + claim.rationale}>
                  <Field label="Metric">
                    <select name="metric" defaultValue={claim.metric || ''}>
                      <option value="">Not identified</option>
                      {metrics.map((m) => (
                        <option value={m} key={m}>
                          {label(m)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="two-fields">
                    <Field label="Reported quantity">
                      <input
                        type="number"
                        step="any"
                        min={0}
                        name="value"
                        defaultValue={claim.value ?? ''}
                      />
                    </Field>
                    <Field label="Unit">
                      <input name="unit" defaultValue={claim.unit || ''} />
                    </Field>
                  </div>
                  <div className="two-fields">
                    <Field label="Reporting year">
                      <input
                        type="number"
                        name="year"
                        defaultValue={claim.year || ''}
                        min={1990}
                        max={2100}
                      />
                    </Field>
                    <Field label="Explicit baseline year">
                      <input
                        type="number"
                        name="baseline_year"
                        defaultValue={claim.baseline_year || ''}
                        min={1990}
                        max={2100}
                      />
                    </Field>
                  </div>
                  <div className="two-fields">
                    <Field label="Claimed change (%)">
                      <input
                        type="number"
                        step="any"
                        name="claimed_change"
                        defaultValue={claim.claimed_change ?? ''}
                        min={0}
                      />
                    </Field>
                    <Field label="Direction">
                      <select name="direction" defaultValue={claim.direction || ''}>
                        <option value="">Not stated</option>
                        <option value="decrease">Decrease</option>
                        <option value="increase">Increase</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Reporting boundary">
                    <input name="boundary" required defaultValue={claim.boundary || ''} />
                  </Field>
                  <Field label="Facility">
                    <select name="facility_id" defaultValue={claim.facility_id || ''}>
                      <option value="">Company-wide</option>
                      {data.facilities.map((f: Item) => (
                        <option value={f.id} key={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="SDG numbers, comma separated">
                    <input name="sdgs" defaultValue={claim.sdgs.join(', ')} />
                  </Field>
                  <Field label="Correction rationale">
                    <textarea
                      name="rationale"
                      required
                      minLength={8}
                      placeholder="State the source evidence supporting the correction."
                    />
                  </Field>
                  <button className="button secondary" disabled={busy}>
                    <Save size={16} />
                    Save correction
                  </button>
                </form>
              </section>
            </div>
          )}
          {tab === 'label' && (
            <>
              <div className="callout info">
                Create an independent human reference label. Development labels help tune the
                pipeline; only test labels are included in measured evaluations.
              </div>
              <form className="form-grid" onSubmit={annotate}>
                <Field label="Expected evidence status">
                  <select name="expectedStatus" required defaultValue="">
                    <option value="" disabled>
                      Select after reviewing evidence
                    </option>
                    <option value="supported">Supported</option>
                    <option value="needs_review">Needs review</option>
                    <option value="insufficient_evidence">Insufficient evidence</option>
                  </select>
                </Field>
                <Field label="Expected SDG numbers">
                  <input name="goals" placeholder="For example: 6, 12" />
                </Field>
                <Field label="Dataset split">
                  <select name="split">
                    <option value="test">Held-out test</option>
                    <option value="development">Development / tuning</option>
                  </select>
                </Field>
                <fieldset className="citation-select">
                  <legend>Relevant evidence passages</legend>
                  {[
                    { ...claim.source },
                    ...claim.retrieved.filter((p: Item) => p.id !== claim.source.id),
                  ].map((p: Item) => (
                    <label className="checkbox" key={p.id}>
                      <input name="chunks" type="checkbox" value={p.id} />
                      <span>
                        {p.report_name} · source {p.page_number}
                        <small>{p.text.slice(0, 200)}…</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <button className="button primary" disabled={busy}>
                  <ClipboardCheck size={16} />
                  Save human label
                </button>
              </form>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
