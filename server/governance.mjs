import { sendOfficeReport } from './office-exports.mjs';
import {
  companyStatusReport,
  evidenceStatusReport,
  oversightStatusReport,
  sendStatusReport,
} from './status-exports.mjs';
import { exportRows, csvExport, writePdf } from './exports.mjs';
import { z } from 'zod';
import { uuid, now } from './db.mjs';
import { hashPassword } from './auth.mjs';
import { METRICS, normalize, csvCell } from './domain.mjs';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const licenceStatus = z.enum(['pending', 'active', 'suspended', 'revoked']);
const reviewStatus = z.enum(['submitted', 'under_review', 'accepted', 'follow_up', 'rejected']);
const reason = z.string().trim().min(10).max(3000);
const metric = z.enum(METRICS);
export function migrateGovernance(store) {
  const userColumns = store.q('PRAGMA table_info(users)');
  if (!userColumns.some((c) => c.name === 'disabled'))
    store.db.exec('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0');
  store.db.exec(
    'CREATE TABLE IF NOT EXISTS government_admins(user_id TEXT PRIMARY KEY REFERENCES users(id),authority TEXT NOT NULL,demo_company_id TEXT REFERENCES companies(id));' +
      "CREATE TABLE IF NOT EXISTS company_registry(company_id TEXT PRIMARY KEY REFERENCES companies(id),licence_number TEXT UNIQUE,licence_status TEXT NOT NULL DEFAULT 'pending',licence_reason TEXT NOT NULL DEFAULT '',public_visible INTEGER NOT NULL DEFAULT 0,publish_environment INTEGER NOT NULL DEFAULT 0,public_description TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS oversight_actions(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),type TEXT NOT NULL,note TEXT NOT NULL,public_note TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'open',created_by TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),text TEXT NOT NULL,year INTEGER NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'submitted',review_note TEXT NOT NULL DEFAULT '',submitted_by TEXT NOT NULL REFERENCES users(id),reviewed_by TEXT REFERENCES users(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);" +
      'CREATE TABLE IF NOT EXISTS meter_readings(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),facility_id TEXT REFERENCES facilities(id),metric TEXT NOT NULL,value REAL NOT NULL,unit TEXT NOT NULL,recorded_at TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE INDEX IF NOT EXISTS submission_company ON submissions(company_id,created_at);' +
      'CREATE INDEX IF NOT EXISTS meter_company ON meter_readings(company_id,recorded_at);',
  );
}
export function governanceTools(store, config, auth) {
  migrateGovernance(store);
  function registry(id) {
    if (!store.get('SELECT id FROM companies WHERE id=?', id))
      throw fail('Company not found.', 404);
    if (!store.get('SELECT company_id FROM company_registry WHERE company_id=?', id))
      store.insert('company_registry', {
        company_id: id,
        licence_number: null,
        licence_status: 'pending',
        licence_reason: '',
        public_visible: 0,
        publish_environment: 0,
        public_description: '',
        updated_at: now(),
      });
    return store.get('SELECT * FROM company_registry WHERE company_id=?', id);
  }
  function authority(user) {
    return store.get('SELECT * FROM government_admins WHERE user_id=?', user.id);
  }
  function guard(req, res, next) {
    const a = authority(req.user);
    if (!a) return res.status(403).json({ error: 'Government administrator access is required.' });
    req.authority = a;
    next();
  }
  function scoped(req, id) {
    const a = req.authority || authority(req.user);
    if (!a || (a.demo_company_id && a.demo_company_id !== id))
      throw fail('Company not found in this authority workspace.', 404);
    const c = store.get(
      'SELECT * FROM companies WHERE id=? AND id NOT IN (SELECT company_id FROM users WHERE id IN (SELECT user_id FROM government_admins WHERE demo_company_id IS NULL))',
      id,
    );
    if (!c) throw fail('Company not found.', 404);
    return c;
  }
  function companyGuard(req, res, next) {
    if (req.path.startsWith('/auth/')) return next();
    if (authority(req.user))
      return res
        .status(403)
        .json({ error: 'Use the Government Oversight portal for this account.' });
    const r = registry(req.user.company_id);
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      ['suspended', 'revoked'].includes(r.licence_status)
    )
      return res.status(403).json({
        error:
          'This CarbonX licence is ' +
          r.licence_status +
          '. Submission and workspace changes are paused. Contact Government Oversight.',
      });
    next();
  }
  function listCompanies(req) {
    const a = req.authority,
      params = a.demo_company_id ? [a.demo_company_id] : [];
    const companies = store.q(
      'SELECT c.* FROM companies c WHERE c.id NOT IN (SELECT company_id FROM users WHERE id IN (SELECT user_id FROM government_admins WHERE demo_company_id IS NULL))' +
        (a.demo_company_id ? ' AND c.id=?' : '') +
        ' ORDER BY c.created_at DESC',
      ...params,
    );
    return companies.map((c) => ({
      ...c,
      ...registry(c.id),
      report_count: store.get(
        'SELECT COUNT(*) n FROM reports WHERE company_id=? AND archived=0',
        c.id,
      ).n,
      submission_count: store.get(
        "SELECT COUNT(*) n FROM submissions WHERE company_id=? AND status IN ('submitted','under_review','follow_up')",
        c.id,
      ).n,
    }));
  }
  function publicCompany(c) {
    const r = registry(c.id);
    const seen = new Set(),
      metrics = [];
    // Never add values across different facilities, boundaries or units.
    for (const o of store.q(
      'SELECT o.*,f.name facility_name FROM observations o LEFT JOIN facilities f ON f.id=o.facility_id WHERE o.company_id=? ORDER BY o.year DESC,o.created_at DESC',
      c.id,
    )) {
      const key = JSON.stringify([
        o.metric,
        o.facility_id,
        o.boundary.toLowerCase().trim(),
        o.normalized_unit,
      ]);
      if (seen.has(key)) continue;
      seen.add(key);
      metrics.push({
        metric: o.metric,
        value: o.normalized_value,
        unit: o.normalized_unit,
        year: o.year,
        scope: o.facility_name || 'Company-wide',
        boundary: o.boundary,
        recordedAt: o.created_at,
        origin: 'Company-reported historical record',
      });
    }
    const readings = store
      .q(
        'SELECT m.metric,m.value,m.unit,m.recorded_at,f.name facility FROM meter_readings m LEFT JOIN facilities f ON f.id=m.facility_id WHERE m.company_id=? ORDER BY m.recorded_at DESC LIMIT 60',
        c.id,
      )
      .map((m) => ({
        metric: m.metric,
        value: m.value,
        unit: m.unit,
        recordedAt: m.recorded_at,
        scope: m.facility || 'Company-wide',
        origin: 'Company-submitted reading',
      }));
    let environmental = [];
    if (r.publish_environment) {
      const current = store.q(
          'SELECT e.kind,e.status,e.payload_json,e.created_at,f.name facility FROM environment e JOIN facilities f ON f.id=e.facility_id WHERE e.company_id=? ORDER BY e.created_at DESC',
          c.id,
        ),
        found = new Set();
      for (const e of current) {
        const key = e.kind + '|' + e.facility;
        if (found.has(key)) continue;
        found.add(key);
        let p;
        try {
          p = JSON.parse(e.payload_json);
        } catch {
          continue;
        }
        if (e.kind === 'atmosphere')
          environmental.push({
            kind: 'atmosphere',
            facility: e.facility,
            status: e.status,
            retrievedAt: e.created_at,
            sources: (p.sources || []).map((s) => ({
              kind: s.kind,
              status: s.status,
              time: s.data?.current?.time || null,
              temperature: s.data?.current?.temperature_2m ?? null,
              humidity: s.data?.current?.relative_humidity_2m ?? null,
              pm25: s.data?.current?.pm2_5 ?? null,
              pm10: s.data?.current?.pm10 ?? null,
              no2: s.data?.current?.nitrogen_dioxide ?? null,
            })),
          });
        if (e.kind === 'satellite' && e.status === 'available')
          environmental.push({
            kind: 'satellite',
            facility: e.facility,
            status: e.status,
            retrievedAt: e.created_at,
            before: { date: p.before.date, ndvi: p.before.meanNDVI, ndwi: p.before.meanNDWI },
            after: { date: p.after.date, ndvi: p.after.meanNDVI, ndwi: p.after.meanNDWI },
          });
      }
    }
    const counts = store.q(
      'SELECT status,COUNT(*) n FROM submissions WHERE company_id=? GROUP BY status',
      c.id,
    );
    return {
      id: c.id,
      name: c.name,
      isExample: Boolean(c.is_example),
      description: r.public_description,
      licence: { number: r.licence_number, status: r.licence_status, updatedAt: r.updated_at },
      metrics,
      readings,
      environmental,
      submissions: counts,
      notices: store.q(
        "SELECT type,public_note text,created_at FROM oversight_actions WHERE company_id=? AND public_note<>'' ORDER BY created_at DESC LIMIT 10",
        c.id,
      ),
      updatedAt: r.updated_at,
    };
  }
  function publicRoutes(app) {
    app.get('/api/public/config', (_req, res) =>
      res.json({
        allowDemo: config.allowDemo,
        allowRegistration: config.allowRegistration,
        authority: 'Government Oversight',
      }),
    );
    app.get('/api/public/overview', (_req, res) => {
      const companies = store
        .q(
          'SELECT c.* FROM companies c JOIN company_registry r ON r.company_id=c.id WHERE r.public_visible=1 ORDER BY c.name',
        )
        .map(publicCompany);
      res.json({
        companies,
        refreshedAt: now(),
        refreshSeconds: 30,
        usageNote:
          'Usage values are company-reported records, not continuous meter telemetry. Environmental values show their provider and retrieval times.',
        authority: 'Government Oversight',
      });
    });
  }
  function protectedRoutes(app) {
    app.use('/api/government', guard);
    app.get('/api/government/overview', (req, res) => {
      const companies = listCompanies(req),
        ids = companies.map((c) => c.id);
      const actions = store
        .q(
          'SELECT a.*,c.name company_name,u.name actor FROM oversight_actions a JOIN companies c ON c.id=a.company_id LEFT JOIN users u ON u.id=a.created_by ORDER BY a.created_at DESC',
        )
        .filter((a) => ids.includes(a.company_id));
      const submissions = store
        .q(
          'SELECT s.*,c.name company_name FROM submissions s JOIN companies c ON c.id=s.company_id ORDER BY s.created_at DESC',
        )
        .filter((s) => ids.includes(s.company_id));
      const users = store
        .q(
          'SELECT u.id,u.company_id,u.name,u.email,u.role,u.disabled,c.name company_name,g.user_id government FROM users u JOIN companies c ON c.id=u.company_id LEFT JOIN government_admins g ON g.user_id=u.id ORDER BY u.created_at DESC',
        )
        .filter(
          (u) => ids.includes(u.company_id) || (!req.authority.demo_company_id && u.government),
        );
      const audit = store
        .q(
          'SELECT a.*,c.name company_name,u.name actor FROM audit a JOIN companies c ON c.id=a.company_id LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 1000',
        )
        .filter((a) => ids.includes(a.company_id) || a.user_id === req.user.id)
        .slice(0, 100);
      res.json({
        companies,
        actions,
        submissions,
        users,
        audit,
        authority: req.authority.authority,
        demo: Boolean(req.authority.demo_company_id),
        stats: {
          companies: companies.length,
          pending: submissions.filter((s) =>
            ['submitted', 'under_review', 'follow_up'].includes(s.status),
          ).length,
          openCases: actions.filter((a) => a.status === 'open').length,
          suspended: companies.filter((c) => c.licence_status === 'suspended').length,
        },
      });
    });
    app.get('/api/government/companies/:id', (req, res) => {
      const company = scoped(req, req.params.id);
      res.json({
        company: { ...company, ...registry(company.id) },
        reports: store.q(
          'SELECT id,name,year,status,archived,created_at FROM reports WHERE company_id=? ORDER BY created_at DESC',
          company.id,
        ),
        claims: store.q(
          'SELECT c.id,c.text,c.status,c.review_state,c.year,c.reason_json,p.number page_number,r.name report_name,r.id report_id FROM claims c JOIN reports r ON r.id=c.report_id JOIN chunks k ON k.id=c.chunk_id JOIN pages p ON p.id=k.page_id WHERE c.company_id=? AND r.archived=0',
          company.id,
        ),
        observations: store.q(
          'SELECT metric,year,value,unit,boundary,source FROM observations WHERE company_id=? ORDER BY year DESC',
          company.id,
        ),
        actions: store.q(
          'SELECT * FROM oversight_actions WHERE company_id=? ORDER BY created_at DESC',
          company.id,
        ),
      });
    });
    app.get('/api/government/companies/:id/reports/:reportId/file', (req, res) => {
      scoped(req, req.params.id);
      const report = store.get(
        'SELECT * FROM reports WHERE company_id=? AND id=?',
        req.params.id,
        req.params.reportId,
      );
      if (!report) throw fail('Report not found.', 404);
      res.set('Content-Type', report.mime);
      res.set('Cache-Control', 'private, no-store');
      if (req.query.download === '1') res.attachment(report.original_name);
      else res.set('Content-Disposition', 'inline');
      res.sendFile(report.stored_name, { root: config.dataDir + '/uploads' });
    });
    app.post('/api/government/companies', async (req, res) => {
      if (req.authority.demo_company_id)
        throw fail(
          'The government demonstration is limited to its existing synthetic company.',
          403,
        );
      const b = z.object({ name: z.string().trim().min(2).max(120) }).parse(req.body),
        id = uuid('org_');
      store.insert('companies', { id, name: b.name, is_example: 0, created_at: now() });
      registry(id);
      store.audit(id, req.user.id, 'company.registered_by_authority', 'company', id);
      res.status(201).json({ id });
    });
    app.patch('/api/government/companies/:id/licence', (req, res) => {
      scoped(req, req.params.id);
      const b = z
          .object({
            status: licenceStatus,
            expectedStatus: licenceStatus,
            number: z.string().trim().max(60).optional(),
            reason,
          })
          .parse(req.body),
        r = registry(req.params.id);
      if (r.licence_status !== b.expectedStatus)
        throw fail('Licence status changed. Refresh and review it again.', 409);
      store.transaction(() => {
        store.run(
          'UPDATE company_registry SET licence_status=?,licence_number=?,licence_reason=?,updated_at=? WHERE company_id=?',
          b.status,
          b.number || r.licence_number,
          b.reason,
          now(),
          req.params.id,
        );
        store.insert('oversight_actions', {
          id: uuid('case_'),
          company_id: req.params.id,
          type: 'licence_' + b.status,
          note: b.reason,
          public_note: '',
          status: 'resolved',
          created_by: req.user.id,
          created_at: now(),
          updated_at: now(),
        });
        store.audit(req.params.id, req.user.id, 'licence.updated', 'company', req.params.id, {
          before: r.licence_status,
          after: b.status,
          reason: b.reason,
        });
      });
      res.json(registry(req.params.id));
    });
    app.patch('/api/government/companies/:id/publication', (req, res) => {
      scoped(req, req.params.id);
      const b = z
        .object({
          visible: z.boolean(),
          environment: z.boolean(),
          description: z.string().trim().max(500),
        })
        .parse(req.body);
      registry(req.params.id);
      store.transaction(() => {
        store.run(
          'UPDATE company_registry SET public_visible=?,publish_environment=?,public_description=?,updated_at=? WHERE company_id=?',
          b.visible ? 1 : 0,
          b.environment ? 1 : 0,
          b.description,
          now(),
          req.params.id,
        );
        store.audit(
          req.params.id,
          req.user.id,
          'public.summary_updated_by_authority',
          'company',
          req.params.id,
          { visible: b.visible, environment: b.environment },
        );
      });
      res.json({ ok: true });
    });
    app.post('/api/government/actions', (req, res) => {
      const b = z
        .object({
          companyId: z.string(),
          type: z.enum([
            'request_evidence',
            'issue_notice',
            'schedule_inspection',
            'record_finding',
            'report_incident',
          ]),
          note: reason,
          publicNote: z.string().trim().max(1000).default(''),
        })
        .parse(req.body);
      scoped(req, b.companyId);
      const id = uuid('case_');
      store.transaction(() => {
        store.insert('oversight_actions', {
          id,
          company_id: b.companyId,
          type: b.type,
          note: b.note,
          public_note: b.publicNote,
          status: 'open',
          created_by: req.user.id,
          created_at: now(),
          updated_at: now(),
        });
        store.audit(b.companyId, req.user.id, 'oversight.action_recorded', 'case', id, {
          type: b.type,
          public: Boolean(b.publicNote),
        });
      });
      res.status(201).json({ id });
    });
    app.patch('/api/government/actions/:id', (req, res) => {
      const a = store.get('SELECT * FROM oversight_actions WHERE id=?', req.params.id);
      if (!a) throw fail('Case not found.', 404);
      scoped(req, a.company_id);
      const b = z.object({ status: z.enum(['open', 'resolved']), note: reason }).parse(req.body);
      store.transaction(() => {
        store.run(
          'UPDATE oversight_actions SET status=?,updated_at=? WHERE id=?',
          b.status,
          now(),
          a.id,
        );
        store.audit(a.company_id, req.user.id, 'oversight.case_updated', 'case', a.id, b);
      });
      res.json({ ok: true });
    });
    app.patch('/api/government/submissions/:id', (req, res) => {
      const s = store.get('SELECT * FROM submissions WHERE id=?', req.params.id);
      if (!s) throw fail('Submission not found.', 404);
      scoped(req, s.company_id);
      const b = z.object({ status: reviewStatus, note: reason }).parse(req.body);
      store.transaction(() => {
        store.run(
          'UPDATE submissions SET status=?,review_note=?,reviewed_by=?,updated_at=? WHERE id=?',
          b.status,
          b.note,
          req.user.id,
          now(),
          s.id,
        );
        store.audit(s.company_id, req.user.id, 'submission.reviewed', 'submission', s.id, b);
      });
      res.json({ ok: true });
    });
    app.post('/api/government/users', async (req, res) => {
      const b = z
        .object({
          companyId: z.string(),
          name: z.string().trim().min(2).max(80),
          email: z.email(),
          password: z.string().min(12).max(128),
          role: z.enum(['owner', 'reviewer', 'analyst']),
        })
        .parse(req.body);
      scoped(req, b.companyId);
      if (req.authority.demo_company_id && !b.email.endsWith('@carbonx.invalid'))
        throw fail('Use a synthetic @carbonx.invalid email in the presentation sandbox.');
      if (store.get('SELECT id FROM users WHERE email=?', b.email.toLowerCase()))
        throw fail('This email is already registered.', 409);
      const id = uuid('usr_'),
        password_hash = await hashPassword(b.password);
      store.transaction(() => {
        store.insert('users', {
          id,
          company_id: b.companyId,
          name: b.name,
          email: b.email.toLowerCase(),
          role: b.role,
          password_hash,
          disabled: 0,
          created_at: now(),
        });
        store.audit(b.companyId, req.user.id, 'user.created_by_authority', 'user', id, {
          role: b.role,
        });
      });
      res.status(201).json({ id });
    });
    app.patch('/api/government/users/:id', (req, res) => {
      const user = store.get('SELECT * FROM users WHERE id=?', req.params.id);
      if (!user) throw fail('User not found.', 404);
      scoped(req, user.company_id);
      if (user.id === req.user.id || authority(user))
        throw fail(
          'Government accounts are managed through the protected provisioning process.',
          403,
        );
      const b = z.object({ disabled: z.boolean(), note: reason }).parse(req.body);
      store.transaction(() => {
        store.run('UPDATE users SET disabled=? WHERE id=?', b.disabled ? 1 : 0, user.id);
        if (b.disabled) store.run('DELETE FROM sessions WHERE user_id=?', user.id);
        store.audit(user.company_id, req.user.id, 'user.access_changed', 'user', user.id, b);
      });
      res.json({ ok: true });
    });
    app.get('/api/government/export/:format', (req, res) => {
      const format = z.enum(['pdf', 'docx', 'xlsx', 'csv', 'json']).parse(req.params.format);
      const companies = listCompanies(req);
      const report = oversightStatusReport(store, companies, req.authority.authority);
      store.audit(req.user.company_id, req.user.id, 'government.status_exported', 'export', null, {
        format,
        companyCount: companies.length,
      });
      if (['docx', 'xlsx'].includes(format))
        return sendOfficeReport(res, report, format, 'carbonx-oversight-status');
      sendStatusReport(res, report, format, 'carbonx-oversight-status');
    });
    app.get('/api/government/companies/:id/export/:format', (req, res) => {
      const format = z.enum(['pdf', 'docx', 'xlsx', 'csv', 'json']).parse(req.params.format);
      const company = scoped(req, req.params.id);
      const report = companyStatusReport(
        store,
        company,
        registry(company.id),
        req.authority.authority,
      );
      store.audit(company.id, req.user.id, 'government.company_exported', 'company', company.id, {
        format,
      });
      if (['docx', 'xlsx'].includes(format))
        return sendOfficeReport(res, report, format, 'carbonx-company-status');
      sendStatusReport(res, report, format, 'carbonx-company-status');
    });
    app.get('/api/government/companies/:id/reports/:reportId/export/:format', (req, res) => {
      const format = z.enum(['pdf', 'docx', 'xlsx', 'csv', 'json']).parse(req.params.format);
      const company = scoped(req, req.params.id);
      const report = store.get(
        'SELECT id,name FROM reports WHERE company_id=? AND id=?',
        company.id,
        req.params.reportId,
      );
      if (!report) throw fail('Report not found.', 404);
      const rows = exportRows(store, company.id, report.id);
      store.audit(company.id, req.user.id, 'government.report_exported', 'report', report.id, {
        format,
        count: rows.length,
      });
      res.set('Cache-Control', 'private, no-store');
      if (['docx', 'xlsx'].includes(format))
        return sendOfficeReport(
          res,
          evidenceStatusReport(store, company, report.id, req.authority.authority),
          format,
          'carbonx-report-findings',
        );
      if (format === 'pdf') return writePdf(res, rows, company.name, Boolean(company.is_example));
      res.set(
        'Content-Disposition',
        'attachment; filename="carbonx-report-findings.' + format + '"',
      );
      if (format === 'csv') return res.type('text/csv').send(csvExport(rows));
      res.json({
        company: company.name,
        isExample: Boolean(company.is_example),
        generatedAt: now(),
        report,
        claims: rows.map(({ sdgs_json, reason_json, comparison_json, ...row }) => ({
          ...row,
          sdgs: JSON.parse(sdgs_json),
          reasons: JSON.parse(reason_json),
          comparison: JSON.parse(comparison_json),
        })),
      });
    });
    app.get('/api/government/export', (req, res) => {
      const rows = listCompanies(req),
        keys = [
          'name',
          'licence_number',
          'licence_status',
          'report_count',
          'submission_count',
          'updated_at',
        ];
      res
        .type('text/csv')
        .set('Content-Disposition', 'attachment; filename="carbonx-oversight.csv"')
        .send(
          [
            keys.map(csvCell).join(','),
            ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(',')),
          ].join('\r\n'),
        );
    });
    app.use('/api/company', (req, res, next) => {
      if (authority(req.user))
        return res.status(403).json({ error: 'Company access is required.' });
      const r = registry(req.user.company_id);
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        ['suspended', 'revoked'].includes(r.licence_status)
      )
        return res.status(403).json({
          error: 'Submissions are paused while this CarbonX licence is ' + r.licence_status + '.',
        });
      next();
    });
    app.get('/api/company/export/:format', (req, res) => {
      const format = z.enum(['pdf', 'docx', 'xlsx', 'csv', 'json']).parse(req.params.format);
      const company = store.get(
        'SELECT id,name,is_example FROM companies WHERE id=?',
        req.user.company_id,
      );
      const report = companyStatusReport(store, company, registry(company.id), 'Company workspace');
      store.audit(company.id, req.user.id, 'company.status_exported', 'company', company.id, {
        format,
      });
      if (['docx', 'xlsx'].includes(format))
        return sendOfficeReport(res, report, format, 'carbonx-company-status');
      sendStatusReport(res, report, format, 'carbonx-company-status');
    });
    app.get('/api/company/overview', (req, res) =>
      res.json({
        registry: registry(req.user.company_id),
        submissions: store.q(
          'SELECT * FROM submissions WHERE company_id=? ORDER BY created_at DESC',
          req.user.company_id,
        ),
        actions: store.q(
          'SELECT id,type,note,status,created_at FROM oversight_actions WHERE company_id=? ORDER BY created_at DESC',
          req.user.company_id,
        ),
        readings: store.q(
          'SELECT * FROM meter_readings WHERE company_id=? ORDER BY recorded_at DESC LIMIT 50',
          req.user.company_id,
        ),
      }),
    );
    app.patch('/api/company/publication', auth.roles('owner'), (req, res) => {
      const b = z
        .object({
          visible: z.boolean(),
          environment: z.boolean(),
          description: z.string().trim().max(500),
        })
        .parse(req.body);
      registry(req.user.company_id);
      store.transaction(() => {
        store.run(
          'UPDATE company_registry SET public_visible=?,publish_environment=?,public_description=?,updated_at=? WHERE company_id=?',
          b.visible ? 1 : 0,
          b.environment ? 1 : 0,
          b.description,
          now(),
          req.user.company_id,
        );
        store.audit(
          req.user.company_id,
          req.user.id,
          'public.summary_updated',
          'company',
          req.user.company_id,
          { visible: b.visible, environment: b.environment },
        );
      });
      res.json({ ok: true });
    });
    app.post('/api/company/submissions', auth.roles('owner', 'analyst'), (req, res) => {
      const b = z
          .object({
            text: z.string().trim().min(30).max(5000),
            year: z.coerce.number().int().min(1990).max(2100),
            source: z.string().trim().min(3).max(500),
          })
          .parse(req.body),
        id = uuid('sub_');
      store.transaction(() => {
        store.insert('submissions', {
          id,
          company_id: req.user.company_id,
          ...b,
          status: 'submitted',
          review_note: '',
          submitted_by: req.user.id,
          reviewed_by: null,
          created_at: now(),
          updated_at: now(),
        });
        store.audit(req.user.company_id, req.user.id, 'claim.submitted', 'submission', id);
      });
      res.status(201).json({ id });
    });
    app.post('/api/company/readings', auth.roles('owner', 'analyst'), (req, res) => {
      const b = z
        .object({
          metric,
          value: z.coerce.number().finite().nonnegative(),
          unit: z.string().trim().min(1).max(20),
          recordedAt: z.iso.datetime(),
          source: z.string().trim().min(3).max(500),
          facilityId: z.string().nullable().optional(),
        })
        .parse(req.body);
      if (Date.parse(b.recordedAt) > Date.now() + 60000)
        throw fail('A reading cannot be dated in the future.');
      const n = normalize(b.value, b.unit, b.metric);
      if (!n) throw fail('Use a compatible unit for this metric.');
      if (
        b.facilityId &&
        !store.get(
          'SELECT id FROM facilities WHERE id=? AND company_id=?',
          b.facilityId,
          req.user.company_id,
        )
      )
        throw fail('Facility not found.', 404);
      const id = uuid('meter_');
      store.transaction(() => {
        store.insert('meter_readings', {
          id,
          company_id: req.user.company_id,
          facility_id: b.facilityId || null,
          metric: b.metric,
          value: n.value,
          unit: n.unit,
          recorded_at: b.recordedAt,
          source: b.source,
          created_at: now(),
        });
        store.audit(req.user.company_id, req.user.id, 'usage.reading_submitted', 'reading', id);
      });
      res.status(201).json({ id });
    });
  }
  return { registry, authority, companyGuard, publicRoutes, protectedRoutes };
}
