import PDFDocument from 'pdfkit';
import { csvCell } from './domain.mjs';
import { exportRows } from './exports.mjs';
const clean = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const label = (v) => v.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const counts = (rows, key) =>
  Object.fromEntries(
    [...new Set(rows.map((r) => r[key]))].map((k) => [k, rows.filter((r) => r[key] === k).length]),
  );
export async function companyStatusReport(store, company, registry, audience) {
  const id = company.id;
  const reports = await store.q(
    'SELECT id,name,year,boundary,original_name,status,mode,page_count,chunk_count,warning,archived,created_at FROM reports WHERE company_id=? ORDER BY created_at DESC',
    id,
  );
  const claims = (await exportRows(store, id)).map(
    ({
      id,
      report_id,
      report_name,
      page_number,
      text,
      metric,
      value,
      unit,
      year,
      baseline_year,
      boundary,
      claimed_change,
      status,
      review_state,
      method,
      reason_json,
      sdgs_json,
      comparison_json,
    }) => ({
      id,
      report_id,
      report_name,
      page_number,
      text,
      metric,
      value,
      unit,
      year,
      baseline_year,
      boundary,
      claimed_change,
      status,
      review_state,
      method,
      reasons: JSON.parse(reason_json),
      sdgs: JSON.parse(sdgs_json),
      comparison: JSON.parse(comparison_json),
    }),
  );
  const submissions = await store.q(
    'SELECT id,text,year,source,status,review_note,created_at,updated_at FROM submissions WHERE company_id=? ORDER BY created_at DESC',
    id,
  );
  const actions = await store.q(
    'SELECT id,type,note,public_note,status,created_at,updated_at FROM oversight_actions WHERE company_id=? ORDER BY created_at DESC',
    id,
  );
  const observations = await store.q(
    'SELECT id,facility_id,metric,year,value,unit,boundary,source,created_at FROM observations WHERE company_id=? ORDER BY year DESC',
    id,
  );
  const readings = await store.q(
    'SELECT id,facility_id,metric,value,unit,recorded_at,source FROM meter_readings WHERE company_id=? ORDER BY recorded_at DESC',
    id,
  );
  const samples = await store.q(
    'SELECT id,facility_id,metric,value,unit,period_start,period_end,measurement_basis,quality,source_kind,source_reference FROM emission_samples WHERE company_id=? ORDER BY period_end DESC',
    id,
  );
  const rules = await store.q(
    'SELECT id,facility_id,metric,threshold,unit,window_minutes,max_age_minutes,measurement_basis,source_reference,active FROM emission_rules WHERE company_id=?',
    id,
  );
  const alerts = (
    await store.q(
      'SELECT id,kind,title,message,status,created_at,updated_at,payload_json FROM monitoring_alerts WHERE company_id=? ORDER BY created_at DESC',
      id,
    )
  ).map(({ payload_json, ...row }) => ({ ...row, evidence: JSON.parse(payload_json) }));
  const reviews = await store.q(
    'SELECT id,claim_id,decision,rationale,created_at FROM reviews WHERE company_id=? ORDER BY created_at DESC',
    id,
  );
  const recommendations = await store.q(
    'SELECT id,claim_id,title,action,priority,status,created_at FROM recommendations WHERE company_id=? ORDER BY created_at DESC',
    id,
  );
  const facilityNames = new Map(
    (await store.q('SELECT id,name FROM facilities WHERE company_id=?', id)).map((f) => [
      f.id,
      f.name,
    ]),
  );
  for (const rows of [observations, readings, samples, rules])
    for (const row of rows) row.facility_name = facilityNames.get(row.facility_id) || null;
  const summary = {
    active_reports: reports.filter((r) => !r.archived).length,
    archived_reports: reports.filter((r) => r.archived).length,
    extracted_claims: claims.length,
    evidence_status: counts(claims, 'status'),
    human_review_status: counts(claims, 'review_state'),
    submission_status: counts(submissions, 'status'),
    pending_submissions: submissions.filter((s) =>
      ['submitted', 'under_review', 'follow_up'].includes(s.status),
    ).length,
    open_cases: actions.filter((a) => a.status === 'open').length,
    open_alerts: alerts.filter((a) => a.status === 'open').length,
  };
  return {
    title: 'Company status report',
    audience,
    generatedAt: new Date().toISOString(),
    notice:
      'Snapshot of CarbonX records. Company-reported usage is not independently verified telemetry. Evidence support and human review are separate from government submission acceptance. Regional air quality and satellite context cannot establish facility emissions or legal violations. Quantities with different units, sites or periods are not added together.',
    company: { id, name: company.name, is_example: Boolean(company.is_example) },
    registry: {
      licence_number: registry.licence_number,
      licence_status: registry.licence_status,
      licence_reason: registry.licence_reason,
      public_visible: Boolean(registry.public_visible),
      updated_at: registry.updated_at,
    },
    summary,
    reports,
    claims,
    submissions,
    actions,
    observations,
    readings,
    samples,
    rules,
    alerts,
    reviews,
    recommendations,
  };
}
export async function oversightStatusReport(store, companies, authority) {
  const rows = await Promise.all(
    companies.map(async (c) => {
      const submissions = await store.q('SELECT status FROM submissions WHERE company_id=?', c.id);
      const claims = await store.q(
        'SELECT status,review_state FROM claims WHERE company_id=?',
        c.id,
      );
      return {
        id: c.id,
        name: c.name,
        is_example: Boolean(c.is_example),
        licence_number: c.licence_number,
        licence_status: c.licence_status,
        public_visible: Boolean(c.public_visible),
        active_reports: c.report_count,
        pending_submissions: c.submission_count,
        accepted_submissions: submissions.filter((s) => s.status === 'accepted').length,
        rejected_submissions: submissions.filter((s) => s.status === 'rejected').length,
        extracted_claims: claims.length,
        supported_claims: claims.filter((x) => x.status === 'supported').length,
        claims_needing_evidence_or_review: claims.filter((x) => x.status !== 'supported').length,
        human_reviewed_claims: claims.filter((x) => x.review_state !== 'unreviewed').length,
        open_cases: (
          await store.get(
            "SELECT COUNT(*) n FROM oversight_actions WHERE company_id=? AND status='open'",
            c.id,
          )
        ).n,
        open_alerts: (
          await store.get(
            "SELECT COUNT(*) n FROM monitoring_alerts WHERE company_id=? AND status='open'",
            c.id,
          )
        ).n,
        updated_at: c.updated_at,
      };
    }),
  );
  return {
    title: 'Government oversight status report',
    audience: authority,
    generatedAt: new Date().toISOString(),
    notice:
      'Only companies available to this government account are included. Synthetic companies are marked individually. Counts summarize CarbonX records, not legal compliance findings. Regional city alerts are not attributed to companies. Different facility measurements are not aggregated.',
    summary: {
      companies: rows.length,
      synthetic_companies: rows.filter((r) => r.is_example).length,
      licence_status: counts(rows, 'licence_status'),
      active_reports: rows.reduce((n, r) => n + r.active_reports, 0),
      pending_submissions: rows.reduce((n, r) => n + r.pending_submissions, 0),
      open_cases: rows.reduce((n, r) => n + r.open_cases, 0),
      open_alerts: rows.reduce((n, r) => n + r.open_alerts, 0),
    },
    companies: rows,
  };
}
export function statusSections(report) {
  const sections = [{ title: 'Summary', rows: [report.summary] }];
  if (report.company)
    sections.push(
      { title: 'Company', rows: [report.company] },
      { title: 'Licence record', rows: [report.registry] },
    );
  for (const key of [
    'companies',
    'reports',
    'claims',
    'submissions',
    'actions',
    'observations',
    'readings',
    'samples',
    'rules',
    'alerts',
    'reviews',
    'recommendations',
  ])
    if (report[key]) sections.push({ title: label(key), rows: report[key] });
  return sections;
}
export function statusCsv(report) {
  const rows = [
    ['section', 'company', 'record_id', 'field', 'value'],
    ['metadata', '', '', 'title', report.title],
    ['metadata', '', '', 'generated_at', report.generatedAt],
    ['metadata', '', '', 'notice', report.notice],
  ];
  for (const section of statusSections(report)) {
    if (!section.rows.length)
      rows.push([section.title, report.company?.name || '', '', 'records', 0]);
    for (const [i, row] of section.rows.entries())
      for (const [key, value] of Object.entries(row))
        rows.push([
          section.title,
          row.name || report.company?.name || '',
          row.id || String(i + 1),
          key,
          clean(value),
        ]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}
export function sendStatusReport(res, report, format, filename) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Disposition', 'attachment; filename="' + filename + '.' + format + '"');
  if (format === 'json') return res.json(report);
  if (format === 'csv') return res.type('text/csv').send(statusCsv(report));
  if (format !== 'pdf') throw Object.assign(Error('Choose pdf, csv or json.'), { status: 400 });
  const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true });
  res.type('application/pdf');
  doc.pipe(res);
  doc.fontSize(21).fillColor('#133f34').text('CarbonX');
  doc.fontSize(16).text(report.title);
  doc
    .moveDown(0.5)
    .fontSize(9)
    .fillColor('#52675c')
    .text(report.audience + ' | ' + report.generatedAt);
  if (report.company?.is_example) doc.text('SYNTHETIC EXAMPLE COMPANY');
  doc.moveDown().fontSize(9).text(report.notice);
  const titles = {
    reports: 'Reports',
    claims: 'Report findings',
    submissions: 'Submitted claims',
    actions: 'Government actions',
    observations: 'Historical reported usage',
    readings: 'Usage readings',
    samples: 'Emissions observations',
    rules: 'Monitoring thresholds',
    alerts: 'Recorded alerts',
    reviews: 'Claim review history',
    recommendations: 'Recommended actions',
    companies: 'Company status',
  };
  const linesFor = (row) =>
    Object.entries(row)
      .filter(([key]) => key !== 'id' && !key.endsWith('_id') && key !== 'evidence')
      .map(([key, value]) => {
        const display =
          value == null || value === ''
            ? 'Not recorded'
            : typeof value === 'boolean'
              ? value
                ? 'Yes'
                : 'No'
              : Array.isArray(value)
                ? value.map(clean).join('; ')
                : typeof value === 'object'
                  ? Object.entries(value)
                      .map(([k, v]) => label(k) + ': ' + clean(v))
                      .join('; ')
                  : ['status', 'review_state', 'metric', 'priority', 'kind', 'type'].includes(key)
                    ? label(String(value))
                    : String(value);
        return label(key) + ': ' + display;
      });
  const needed = (row) => {
    doc.fontSize(9);
    return linesFor(row).reduce((n, line) => n + doc.heightOfString(line, { width: 503 }), 30);
  };
  for (const section of statusSections(report)) {
    const title = titles[section.title.toLowerCase()] || section.title;
    const first = section.rows[0];
    if (doc.y > 680 || (first && needed(first) + 50 > 750 - doc.y && needed(first) < 650))
      doc.addPage();
    doc.moveDown().fontSize(14).fillColor('#133f34').text(title);
    if (!section.rows.length) doc.fontSize(9).fillColor('#52675c').text('No records.');
    for (const [index, row] of section.rows.entries()) {
      const height = needed(row);
      if (doc.y > 680 || (height < 650 && height > 750 - doc.y)) doc.addPage();
      doc.moveDown(0.5);
      if (section.rows.length > 1)
        doc
          .fontSize(11)
          .fillColor('#133f34')
          .text(row.name || row.title || row.report_name || title + ' ' + (index + 1));
      for (const line of linesFor(row)) {
        if (doc.y > 735) doc.addPage();
        doc.fontSize(9).fillColor('#243c30').text(line);
      }
    }
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#6b7a70')
      .text('CarbonX | ' + (i + 1) + ' / ' + range.count, 46, 795, { lineBreak: false });
  }
  doc.end();
}
export async function evidenceStatusReport(store, company, reportId, audience) {
  const claims = (await exportRows(store, company.id, reportId)).map(
    ({ sdgs_json, reason_json, comparison_json, ...row }) => ({
      ...row,
      sdgs: JSON.parse(sdgs_json),
      reasons: JSON.parse(reason_json),
      comparison: JSON.parse(comparison_json),
    }),
  );
  const reports = await store.q(
    'SELECT id,name,year,boundary,status,mode,archived,created_at FROM reports WHERE company_id=?' +
      (reportId ? ' AND id=?' : ''),
    company.id,
    ...(reportId ? [reportId] : []),
  );
  return {
    title: 'Report evidence review',
    audience,
    generatedAt: new Date().toISOString(),
    notice:
      'Source-linked findings from CarbonX records. Evidence support, human review and government approval are different decisions. Source statements remain company-reported evidence, not independent assurance.',
    company: { id: company.id, name: company.name, is_example: Boolean(company.is_example) },
    summary: {
      reports: reports.length,
      extracted_claims: claims.length,
      evidence_status: counts(claims, 'status'),
      human_review_status: counts(claims, 'review_state'),
    },
    reports,
    claims,
  };
}
