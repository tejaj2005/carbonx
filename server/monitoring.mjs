import { demoCompanyIds } from './demo.mjs';
const asyncFilter = async (rows, predicate) => {
  const mask = await Promise.all(rows.map(predicate));
  return rows.filter((_, i) => mask[i]);
};
import { TASK_PROMPTS } from './prompts.mjs';
import { z } from 'zod';
import { uuid, now } from './db.mjs';
import {
  INDIA_METROS,
  INDIA_SOURCES,
  fetchMetroModel,
  fetchCpcbStations,
  cpcbAccess,
  assessEmission,
} from './india.mjs';
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const metrics = ['ghg', 'pm_stack', 'so2_stack', 'nox_stack', 'co_stack'];
const expectedUnit = (metric) => (metric === 'ghg' ? 'tCO2e' : 'mg/Nm3');
export async function monitoringTools(store, config, ai, adapters = {}) {
  const modelFetcher = adapters.model || fetchMetroModel,
    stationFetcher = adapters.station || fetchCpcbStations;
  await store.db.exec(
    'CREATE TABLE IF NOT EXISTS metro_cache(city_id TEXT PRIMARY KEY,model_json TEXT,station_json TEXT,last_attempt TEXT,last_success TEXT,next_run TEXT NOT NULL,lease_until TEXT,error TEXT);' +
      'CREATE TABLE IF NOT EXISTS city_watch(company_id TEXT NOT NULL,city_id TEXT NOT NULL,PRIMARY KEY(company_id,city_id));' +
      'CREATE TABLE IF NOT EXISTS emission_rules(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,facility_id TEXT NOT NULL,metric TEXT NOT NULL,threshold REAL NOT NULL,unit TEXT NOT NULL,window_minutes INTEGER NOT NULL,max_age_minutes INTEGER NOT NULL,measurement_basis TEXT NOT NULL,source_reference TEXT NOT NULL,active INTEGER NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS emission_samples(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,facility_id TEXT NOT NULL,metric TEXT NOT NULL,value REAL NOT NULL,unit TEXT NOT NULL,period_start TEXT NOT NULL,period_end TEXT NOT NULL,measurement_basis TEXT NOT NULL,quality TEXT NOT NULL,source_kind TEXT NOT NULL,source_reference TEXT NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS monitoring_alerts(id TEXT PRIMARY KEY,event_key TEXT UNIQUE NOT NULL,scope_key TEXT NOT NULL,company_id TEXT,city_id TEXT,rule_id TEXT,kind TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL,payload_json TEXT NOT NULL,ai_json TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS monitoring_state(scope_key TEXT PRIMARY KEY,state TEXT NOT NULL,alert_id TEXT);' +
      'CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,event_key TEXT NOT NULL,alert_id TEXT,title TEXT NOT NULL,message TEXT NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(user_id,event_key));' +
      'CREATE TABLE IF NOT EXISTS notification_audit_checkpoint(event_id TEXT PRIMARY KEY);' +
      'CREATE INDEX IF NOT EXISTS notification_user ON notifications(user_id,created_at);' +
      'CREATE INDEX IF NOT EXISTS sample_scope ON emission_samples(company_id,facility_id,metric,period_end);',
  );
  for (const c of INDIA_METROS)
    if (!(await store.get('SELECT city_id FROM metro_cache WHERE city_id=?', c.id)))
      await store.insert('metro_cache', {
        city_id: c.id,
        model_json: null,
        station_json: null,
        last_attempt: null,
        last_success: null,
        next_run: now(),
        lease_until: null,
        error: null,
      });
  let stopped = true,
    timer = null,
    running = null;
  const authority = async (user) =>
    await store.get('SELECT * FROM government_admins WHERE user_id=?', user.id);
  async function companyRecipients(id) {
    const company = await store.get('SELECT is_example FROM companies WHERE id=?', id);
    if (!company) return [];
    const users = (await store.q('SELECT id FROM users WHERE company_id=? AND disabled=0', id)).map(
      (u) => u.id,
    );
    if (company.is_example) {
      users.push(
        ...(
          await store.q(
            'SELECT u.id FROM users u JOIN government_admins g ON g.user_id=u.id JOIN demo_members m ON m.root_company_id=g.demo_company_id WHERE m.company_id=? AND u.disabled=0',
            id,
          )
        ).map((u) => u.id),
      );
    }
    if (!company.is_example)
      users.push(
        ...(
          await store.q(
            'SELECT u.id FROM users u JOIN government_admins g ON g.user_id=u.id WHERE g.demo_company_id IS NULL AND u.disabled=0',
          )
        ).map((u) => u.id),
      );
    return [...new Set(users)];
  }
  async function cityRecipients(city) {
    const ids = (
      await Promise.all(
        (await store.q('SELECT company_id FROM city_watch WHERE city_id=?', city)).map(
          async (w) => await companyRecipients(w.company_id),
        ),
      )
    ).flat();
    ids.push(
      ...(
        await store.q(
          'SELECT u.id FROM users u JOIN government_admins g ON g.user_id=u.id WHERE g.demo_company_id IS NULL AND u.disabled=0',
        )
      ).map((u) => u.id),
    );
    return [...new Set(ids)];
  }
  async function notify(event, recipients) {
    for (const userId of recipients)
      await store.run(
        'INSERT OR IGNORE INTO notifications(id,user_id,event_key,alert_id,title,message,kind,created_at,read_at) VALUES(?,?,?,?,?,?,?,?,NULL)',
        uuid('notice_'),
        userId,
        event.event_key,
        event.id || null,
        event.title,
        event.message,
        event.kind,
        event.created_at || now(),
      );
  }
  async function recordAssessment(scope, result, details, recipients) {
    if (result === 'not_assessed') return; // Missing evidence must not resolve an existing alert.
    const state = await store.get('SELECT * FROM monitoring_state WHERE scope_key=?', scope);
    if (result === 'above_threshold') {
      if (state?.state === 'above_threshold') {
        await store.run(
          'UPDATE monitoring_alerts SET payload_json=?,updated_at=? WHERE id=?',
          JSON.stringify(details.payload),
          now(),
          state.alert_id,
        );
        return;
      }
      const id = uuid('alert_'),
        event_key = scope + ':' + id;
      await store.transaction(async () => {
        await store.insert('monitoring_alerts', {
          id,
          event_key,
          scope_key: scope,
          company_id: details.companyId || null,
          city_id: details.cityId || null,
          rule_id: details.ruleId || null,
          kind: details.kind,
          title: details.title,
          message: details.message,
          status: 'open',
          payload_json: JSON.stringify(details.payload),
          ai_json: null,
          created_at: now(),
          updated_at: now(),
        });
        await store.run(
          'INSERT INTO monitoring_state VALUES(?,?,?) ON CONFLICT(scope_key) DO UPDATE SET state=excluded.state,alert_id=excluded.alert_id',
          scope,
          result,
          id,
        );
        await notify({ id, event_key, ...details }, recipients);
      });
    } else {
      await store.transaction(async () => {
        if (state?.state === 'above_threshold')
          await store.run(
            "UPDATE monitoring_alerts SET status='resolved',updated_at=? WHERE id=?",
            now(),
            state.alert_id,
          );
        await store.run(
          'INSERT INTO monitoring_state VALUES(?,?,NULL) ON CONFLICT(scope_key) DO UPDATE SET state=excluded.state',
          scope,
          result,
        );
      });
    }
  }
  async function cityAssess(city, model) {
    if (!model?.air || Date.now() - Date.parse(model.retrievedAt) > 6 * 3600000) return;
    for (const [metric, threshold] of [
      ['pm25', 60],
      ['pm10', 100],
    ]) {
      const m = model.means?.find((m) => m.metric === metric);
      if (!m?.complete || m.value === null) continue;
      await recordAssessment(
        'ambient-model:' + city.id + ':' + metric,
        m.value > threshold ? 'above_threshold' : 'within_configured_threshold',
        {
          cityId: city.id,
          kind: 'ambient_model_advisory',
          title: city.name + ': modelled ' + (metric === 'pm25' ? 'PM₂.₅' : 'PM₁₀') + ' advisory',
          message:
            'The completed 24-hour modelled mean is ' +
            m.value.toFixed(1) +
            ' ug/m3 against a ' +
            threshold +
            ' ambient reference. This is regional model context, not a company-emissions or legal finding.',
          payload: {
            ...m,
            threshold,
            metric,
            source: model.source,
            dataKind: 'modelled_context',
            legalFinding: false,
            reference: INDIA_SOURCES.standards,
          },
        },
        await cityRecipients(city.id),
      );
    }
  }
  async function evaluateRules(companyId, includeInactive = false) {
    const rules = await store.q(
      'SELECT * FROM emission_rules WHERE 1=1' +
        (includeInactive ? '' : ' AND active=1') +
        (companyId
          ? ' AND company_id IN (' +
            (Array.isArray(companyId) ? companyId : [companyId]).map(() => '?').join(',') +
            ')'
          : ''),
      ...(companyId ? (Array.isArray(companyId) ? companyId : [companyId]) : []),
    );
    return await Promise.all(
      rules.map(async (rule) => {
        if (!rule.active)
          return {
            ...rule,
            assessment: { status: 'not_assessed', reason: 'This threshold is paused.' },
            sample: null,
          };
        const sample = await store.get(
            'SELECT * FROM emission_samples WHERE company_id=? AND facility_id=? AND metric=? ORDER BY period_end DESC,created_at DESC LIMIT 1',
            rule.company_id,
            rule.facility_id,
            rule.metric,
          ),
          assessment = assessEmission(rule, sample);
        await recordAssessment(
          'rule:' + rule.id,
          assessment.status,
          {
            companyId: rule.company_id,
            ruleId: rule.id,
            kind: 'reported_emissions_threshold',
            title: 'Reported emissions above a configured threshold',
            message:
              (sample?.source_kind === 'synthetic_example'
                ? 'A synthetic presentation '
                : 'A company-submitted ') +
              rule.metric +
              ' observation of ' +
              sample?.value +
              ' ' +
              rule.unit +
              ' is above the configured ' +
              rule.threshold +
              ' threshold. Government review and verified facility evidence are required; no licence action was automated.',
            payload: {
              ...assessment,
              sourceKind: sample?.source_kind || null,
              observedAt: sample?.period_end || null,
              ruleReference: rule.source_reference,
              measurementBasis: rule.measurement_basis,
              windowMinutes: rule.window_minutes,
            },
          },
          await companyRecipients(rule.company_id),
        );
        return { ...rule, assessment, sample: sample || null };
      }),
    );
  }
  async function collectAuditNotifications() {
    const events = await store.q(
      "SELECT a.* FROM audit a LEFT JOIN notification_audit_checkpoint p ON p.event_id=a.id WHERE p.event_id IS NULL AND a.action IN ('claim.submitted','submission.reviewed','licence.updated','oversight.action_recorded') ORDER BY a.created_at LIMIT 200",
    );
    for (const event of events) {
      const name = await store.get(
        'SELECT name,is_example FROM companies WHERE id=?',
        event.company_id,
      );
      if (!name) continue;
      let recipients = await companyRecipients(event.company_id);
      if (event.action === 'claim.submitted')
        recipients = await asyncFilter(recipients, (id) => authority({ id }));
      const titles = {
        'claim.submitted': 'A company claim is ready for review',
        'submission.reviewed': 'Government reviewed a submitted claim',
        'licence.updated': 'Your CarbonX licence status changed',
        'oversight.action_recorded': 'A government follow-up was recorded',
      };
      await store.transaction(async () => {
        await store.run('INSERT OR IGNORE INTO notification_audit_checkpoint VALUES(?)', event.id);
        await notify(
          {
            event_key: 'audit:' + event.id,
            title: titles[event.action],
            message:
              name.name +
              ': open the company or government record to inspect the decision and its reason.',
            kind: 'workspace_event',
            created_at: event.created_at,
          },
          recipients,
        );
      });
    }
  }
  async function overview() {
    const cities = await Promise.all(
      INDIA_METROS.map(async (city) => {
        const c = await store.get('SELECT * FROM metro_cache WHERE city_id=?', city.id);
        return {
          ...city,
          model: c.model_json ? JSON.parse(c.model_json) : null,
          stations: c.station_json
            ? JSON.parse(c.station_json)
            : { status: 'not_configured', records: [] },
          lastAttempt: c.last_attempt,
          lastSuccess: c.last_success,
          nextRun: c.next_run,
          error: c.error,
          freshness: !c.last_success
            ? 'waiting'
            : Date.now() - Date.parse(c.last_success) > 3 * 3600000
              ? 'stale'
              : 'recent',
        };
      }),
    );
    return {
      cities,
      refreshedAt: now(),
      pollMinutes: config.monitorPollMinutes || 30,
      monitorEnabled: config.monitoringEnabled !== false,
      sources: INDIA_SOURCES,
      stationConfigured: cpcbAccess().mode !== 'disabled',
      stationAccessMode: cpcbAccess().mode,
      facilityFeedConfigured: false,
      ai: { provider: config.aiProvider || 'none', configured: ai.available },
      notificationChannels: { inApp: 'available', email: 'not_configured', sms: 'not_configured' },
      productionReady: false,
    };
  }
  async function pollDue() {
    if (running) return running;
    running = (async () => {
      await collectAuditNotifications();
      await evaluateRules();
      const due = await store.q(
        'SELECT * FROM metro_cache WHERE next_run<=? AND (lease_until IS NULL OR lease_until<?)',
        now(),
        now(),
      );
      const tasks = due.map((row) => async () => {
        const city = INDIA_METROS.find((c) => c.id === row.city_id);
        if (!city) return;
        const lease = new Date(Date.now() + 180000).toISOString(),
          claimed = await store.run(
            'UPDATE metro_cache SET lease_until=?,last_attempt=? WHERE city_id=? AND (lease_until IS NULL OR lease_until<?)',
            lease,
            now(),
            city.id,
            now(),
          );
        if (!claimed.changes) return;
        let model,
          stations,
          errorMessage = null;
        const outcomes = await Promise.allSettled([
          modelFetcher(city),
          stationFetcher(city, cpcbAccess().key),
        ]);
        model = outcomes[0].status === 'fulfilled' ? outcomes[0].value : null;
        stations = outcomes[1].status === 'fulfilled' ? outcomes[1].value : null;
        errorMessage = outcomes.some((x) => x.status === 'rejected')
          ? 'A provider request failed. Source timestamps and last successful readings are retained.'
          : null;
        if (stopped && !config.testing) return;
        const modelOk = model?.air && ['available', 'partial'].includes(model.status);
        const previous = await store.get('SELECT * FROM metro_cache WHERE city_id=?', city.id);
        if (!stations) {
          const old = previous.station_json ? JSON.parse(previous.station_json) : { records: [] };
          stations = {
            ...old,
            status: old.records?.length ? 'stale' : 'unavailable',
            accessMode: cpcbAccess().mode === 'sample' ? 'public_sample' : 'personal_key',
            error:
              'CPCB/data.gov.in is rate-limited or unavailable. No replacement readings were generated.',
            lastAttempt: now(),
          };
        }
        await store.run(
          'UPDATE metro_cache SET model_json=?,station_json=?,last_success=?,next_run=?,lease_until=NULL,error=? WHERE city_id=?',
          modelOk ? JSON.stringify(model) : previous.model_json,
          stations ? JSON.stringify(stations) : previous.station_json,
          modelOk ? now() : previous.last_success,
          new Date(Date.now() + (config.monitorPollMinutes || 30) * 60000).toISOString(),
          errorMessage ||
            (!modelOk ? 'Model provider unavailable. Retained readings may be stale.' : null),
          city.id,
        );
        if (modelOk) await cityAssess(city, model);
      });
      // Two cities at a time keep the free providers and local host within a small request budget.
      let index = 0;
      await Promise.all(
        [0, 1].map(async () => {
          while (index < tasks.length) {
            const task = tasks[index++];
            try {
              await task();
            } catch {}
          }
        }),
      );
    })().finally(() => {
      running = null;
    });
    return running;
  }
  function start() {
    if (config.monitoringEnabled === false || config.testing) return;
    stopped = false;
    void pollDue().catch(() => {});
    timer = setInterval(() => void pollDue().catch(() => {}), 60000);
    timer.unref();
  }
  async function stop() {
    stopped = true;
    clearInterval(timer);
    if (running) await running;
  }
  async function allowedCompany(req, id) {
    const a = await authority(req.user);
    if (!a) throw error('Government administrator access is required.', 403);
    if (a.demo_company_id && !(await demoCompanyIds(store, a.demo_company_id)).includes(id))
      throw error('Company not found in this authority workspace.', 404);
    const c = await store.get('SELECT * FROM companies WHERE id=?', id);
    if (!c) throw error('Company not found.', 404);
    return c;
  }
  async function allowedAlert(req, alert) {
    if (alert.city_id) return true;
    const a = await authority(req.user);
    return a
      ? !a.demo_company_id ||
          (await demoCompanyIds(store, a.demo_company_id)).includes(alert.company_id)
      : alert.company_id === req.user.company_id;
  }
  function publicRoutes(app) {
    app.get('/api/public/india', async (_req, res) => res.json(await overview()));
  }
  function protectedRoutes(app) {
    app.get('/api/monitoring', async (req, res) => {
      await collectAuditNotifications();
      const a = await authority(req.user),
        ids = a?.demo_company_id
          ? await demoCompanyIds(store, a.demo_company_id)
          : a
            ? null
            : [req.user.company_id];
      const rules = (await evaluateRules(ids, true)).filter(
        (r) => !ids || ids.includes(r.company_id),
      );
      const alerts = (
        await asyncFilter(
          await store.q('SELECT * FROM monitoring_alerts ORDER BY created_at DESC LIMIT 300'),
          (alert) => allowedAlert(req, alert),
        )
      ).map((a) => ({
        ...a,
        payload: JSON.parse(a.payload_json),
        ai: a.ai_json ? JSON.parse(a.ai_json) : null,
      }));
      if (a)
        for (const alert of alerts.filter((alert) => alert.company_id && alert.status === 'open'))
          await notify(alert, [req.user.id]);
      res.json({
        ...(await overview()),
        rules,
        alerts,
        facilities: (
          await store.q(
            'SELECT f.id,f.name,f.company_id,f.latitude,f.longitude,f.boundary,c.name company_name FROM facilities f JOIN companies c ON c.id=f.company_id',
          )
        ).filter((f) => !ids || ids.includes(f.company_id)),
        watch: (
          await store.q('SELECT city_id FROM city_watch WHERE company_id=?', req.user.company_id)
        ).map((w) => w.city_id),
        notifications: await store.q(
          'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
          req.user.id,
        ),
      });
    });
    app.patch('/api/notifications/:id/read', async (req, res) => {
      const result = await store.run(
        'UPDATE notifications SET read_at=? WHERE id=? AND user_id=?',
        now(),
        req.params.id,
        req.user.id,
      );
      if (!result.changes) throw error('Notification not found.', 404);
      res.json({ ok: true });
    });
    app.post('/api/monitoring/watch', async (req, res) => {
      if ((await authority(req.user)) || req.user.role !== 'owner')
        throw error('A company owner must choose its city subscriptions.', 403);
      const b = z
        .object({ cities: z.array(z.enum(INDIA_METROS.map((c) => c.id))).max(8) })
        .parse(req.body);
      await store.transaction(async () => {
        await store.run('DELETE FROM city_watch WHERE company_id=?', req.user.company_id);
        for (const id of new Set(b.cities))
          await store.insert('city_watch', { company_id: req.user.company_id, city_id: id });
        await store.audit(
          req.user.company_id,
          req.user.id,
          'monitoring.watch_updated',
          'company',
          req.user.company_id,
          { cities: b.cities },
        );
      });
      for (const city of b.cities)
        for (const a of await store.q(
          "SELECT * FROM monitoring_alerts WHERE city_id=? AND status='open'",
          city,
        ))
          await notify(a, await companyRecipients(req.user.company_id));
      res.json({ ok: true });
    });
    app.post('/api/monitoring/rules', async (req, res) => {
      const b = z
        .object({
          companyId: z.string(),
          facilityId: z.string(),
          metric: z.enum(metrics),
          threshold: z.coerce.number().finite().positive(),
          unit: z.string(),
          windowMinutes: z.coerce.number().int().min(1).max(527040),
          maxAgeMinutes: z.coerce.number().int().min(1).max(527040),
          measurementBasis: z.enum(['period_total', 'dry_normalised', 'wet_normalised']),
          sourceReference: z.string().trim().min(5).max(500),
        })
        .parse(req.body);
      await allowedCompany(req, b.companyId);
      if (
        !(await store.get(
          'SELECT id FROM facilities WHERE id=? AND company_id=?',
          b.facilityId,
          b.companyId,
        ))
      )
        throw error('Facility not found.', 404);
      if (b.unit !== expectedUnit(b.metric))
        throw error('Use ' + expectedUnit(b.metric) + ' for this configured metric.');
      if (b.metric === 'ghg' && b.measurementBasis !== 'period_total')
        throw error('Greenhouse-gas totals require a reporting-period basis.');
      const id = uuid('rule_');
      await store.insert('emission_rules', {
        id,
        company_id: b.companyId,
        facility_id: b.facilityId,
        metric: b.metric,
        threshold: b.threshold,
        unit: b.unit,
        window_minutes: b.windowMinutes,
        max_age_minutes: b.maxAgeMinutes,
        measurement_basis: b.measurementBasis,
        source_reference: b.sourceReference,
        active: 1,
        created_at: now(),
      });
      await store.audit(b.companyId, req.user.id, 'monitoring.rule_created', 'rule', id, {
        ...b,
        legalFinding: false,
      });
      await evaluateRules(b.companyId);
      res.status(201).json({ id });
    });
    app.patch('/api/monitoring/rules/:id', async (req, res) => {
      const r = await store.get('SELECT * FROM emission_rules WHERE id=?', req.params.id);
      if (!r) throw error('Rule not found.', 404);
      await allowedCompany(req, r.company_id);
      const b = z.object({ active: z.boolean() }).parse(req.body);
      await store.run('UPDATE emission_rules SET active=? WHERE id=?', b.active ? 1 : 0, r.id);
      await store.audit(r.company_id, req.user.id, 'monitoring.rule_updated', 'rule', r.id, b);
      res.json({ ok: true });
    });
    app.post('/api/company/emissions', async (req, res) => {
      if ((await authority(req.user)) || !['owner', 'analyst'].includes(req.user.role))
        throw error('Company submission access is required.', 403);
      const registry = await store.get(
        'SELECT licence_status FROM company_registry WHERE company_id=?',
        req.user.company_id,
      );
      if (['suspended', 'revoked'].includes(registry?.licence_status))
        throw error('Company submissions are paused.', 403);
      const b = z
        .object({
          facilityId: z.string(),
          metric: z.enum(metrics),
          value: z.coerce.number().finite().nonnegative(),
          unit: z.string(),
          periodStart: z.iso.datetime(),
          periodEnd: z.iso.datetime(),
          measurementBasis: z.enum(['period_total', 'dry_normalised', 'wet_normalised']),
          quality: z.enum(['valid', 'invalid']),
          sourceReference: z.string().trim().min(5).max(500),
        })
        .parse(req.body);
      if (
        !(await store.get(
          'SELECT id FROM facilities WHERE id=? AND company_id=?',
          b.facilityId,
          req.user.company_id,
        ))
      )
        throw error('Facility not found.', 404);
      if (b.unit !== expectedUnit(b.metric))
        throw error('The metric requires ' + expectedUnit(b.metric) + '.');
      if (
        Date.parse(b.periodEnd) <= Date.parse(b.periodStart) ||
        Date.parse(b.periodEnd) > Date.now() + 60000
      )
        throw error('Use an observed period ending no later than now.');
      const id = uuid('measurement_');
      await store.insert('emission_samples', {
        id,
        company_id: req.user.company_id,
        facility_id: b.facilityId,
        metric: b.metric,
        value: b.value,
        unit: b.unit,
        period_start: b.periodStart,
        period_end: b.periodEnd,
        measurement_basis: b.measurementBasis,
        quality: b.quality,
        source_kind: 'company_reported',
        source_reference: b.sourceReference,
        created_at: now(),
      });
      await store.audit(
        req.user.company_id,
        req.user.id,
        'emissions.observation_submitted',
        'measurement',
        id,
      );
      await evaluateRules(req.user.company_id);
      res.status(201).json({ id, sourceKind: 'company_reported' });
    });
    app.post('/api/monitoring/alerts/:id/explain', async (req, res) => {
      const a = await store.get('SELECT * FROM monitoring_alerts WHERE id=?', req.params.id);
      if (!a || !(await allowedAlert(req, a))) throw error('Alert not found.', 404);
      if (!ai.available)
        throw error(
          'Add your AI provider key on the server and restart CarbonX to enable explanations.',
          409,
        );
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
          cautions: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary', 'cautions'],
      };
      const result = await ai.structured(
        schema,
        'monitoring_explanation',
        TASK_PROMPTS.monitoring,
        JSON.stringify({
          title: a.title,
          message: a.message,
          evidence: JSON.parse(a.payload_json),
        }),
      );
      await store.run(
        'UPDATE monitoring_alerts SET ai_json=? WHERE id=?',
        JSON.stringify({
          ...result.data,
          model: result.model,
          generatedAt: now(),
          advisoryOnly: true,
        }),
        a.id,
      );
      res.json({ ok: true });
    });
  }
  return {
    start,
    stop,
    pollDue,
    overview,
    publicRoutes,
    protectedRoutes,
    evaluateRules,
    collectAuditNotifications,
  };
}
