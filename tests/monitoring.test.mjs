import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import {
  INDIA_METROS,
  indiaTimestamp,
  meanModelWindow,
  fetchMetroModel,
  fetchCpcbStations,
  assessEmission,
} from '../server/india.mjs';
import { monitoringTools } from '../server/monitoring.mjs';
import { createApp } from '../server/app.mjs';
import { uuid, now } from '../server/db.mjs';
const clock = Date.parse('2026-11-10T06:30:00Z'),
  end = Math.floor(clock / 3600000) * 3600,
  times = Array.from({ length: 24 }, (_, i) => end - (24 - i) * 3600);
test('model averages require a complete past window and station times use India offset', () => {
  assert.equal(indiaTimestamp('10-11-2026 12:30:00'), '2026-11-10T07:00:00.000Z');
  assert.equal(
    meanModelWindow({ time: times, pm2_5: times.map(() => 72) }, 'pm2_5', clock).value,
    72,
  );
  assert.equal(
    meanModelWindow({ time: times.slice(1), pm2_5: times.map(() => 72) }, 'pm2_5', clock).complete,
    false,
  );
  assert.equal(
    meanModelWindow({ time: times, pm2_5: times.map((_, i) => (i ? 72 : null)) }, 'pm2_5', clock)
      .value,
    null,
  );
});
test('public model and official station adapters preserve provenance without inventing units', async () => {
  const city = INDIA_METROS[0];
  const data = await fetchMetroModel(
    city,
    async (url) =>
      url.includes('air-quality')
        ? {
            current: { time: Math.floor(clock / 1000), pm2_5: 72, pm10: 120 },
            hourly: { time: times, pm2_5: times.map(() => 72), pm10: times.map(() => 120) },
          }
        : { current: { time: Math.floor(clock / 1000), temperature_2m: 28 } },
    clock,
  );
  assert.equal(data.kind, 'modelled_context');
  assert.equal(data.means[0].value, 72);
  assert.ok(data.resolution.includes('45 km'));
  let called = false;
  const missing = await fetchCpcbStations(city, '', async () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(missing.status, 'not_configured');
  const stations = await fetchCpcbStations(city, 'test-not-a-real-key', async () => ({
    total: 1,
    records: [
      {
        station: 'Test station',
        city: 'Delhi',
        pollutant_id: 'PM2.5',
        pollutant_avg: '60',
        last_update: '10-11-2026 12:30:00',
      },
    ],
  }));
  assert.equal(stations.records[0].unit, null);
  assert.equal(stations.records[0].averagingPeriod, null);
  assert.equal(stations.records[0].average, 60);
  assert.ok(!JSON.stringify(stations).includes('test-not-a-real-key'));
  const offline = await fetchMetroModel(
    city,
    async () => {
      throw Error('offline');
    },
    clock,
  );
  assert.equal(offline.air, null);
  assert.equal(offline.status, 'unavailable');
});
const rule = {
  company_id: 'c',
  facility_id: 'f',
  metric: 'pm_stack',
  threshold: 50,
  unit: 'mg/Nm3',
  window_minutes: 60,
  max_age_minutes: 180,
  measurement_basis: 'dry_normalised',
};
const sample = {
  company_id: 'c',
  facility_id: 'f',
  metric: 'pm_stack',
  value: 60,
  unit: 'mg/Nm3',
  period_start: '2026-11-10T05:00:00Z',
  period_end: '2026-11-10T06:00:00Z',
  measurement_basis: 'dry_normalised',
  quality: 'valid',
  source_kind: 'company_reported',
};
test('facility comparisons reject missing, stale, mismatched and invalid observations', () => {
  assert.equal(assessEmission(rule, sample, clock).status, 'above_threshold');
  assert.equal(assessEmission(rule, sample, clock).legalFinding, false);
  for (const patch of [
    { unit: 'ug/m3' },
    { facility_id: 'other' },
    { quality: 'invalid' },
    { period_start: '2026-11-10T05:30:00Z' },
    { measurement_basis: 'wet_normalised' },
    { period_end: '2026-11-10T08:00:00Z' },
  ])
    assert.equal(assessEmission(rule, { ...sample, ...patch }, clock).status, 'not_assessed');
  assert.equal(
    assessEmission({ ...rule, max_age_minutes: 1 }, sample, clock).status,
    'not_assessed',
  );
  assert.equal(assessEmission(rule, null, clock).status, 'not_assessed');
});
const local = path.resolve('.local');
fs.mkdirSync(local, { recursive: true });
const folder = fs.mkdtempSync(path.join(local, 'test-monitoring-'));
const config = {
  dataDir: folder,
  aiEnabled: false,
  aiProvider: 'ollama',
  aiModel: '',
  embeddingModel: '',
  maxUpload: 1024 * 1024,
  secureCookies: false,
  allowDemo: true,
  allowRegistration: true,
  ocrEnabled: false,
  testing: true,
  production: false,
  monitoringEnabled: true,
  monitorPollMinutes: 30,
};
const system = createApp(config),
  app = system.app;
async function account(name) {
  const client = request.agent(app);
  const r = await client.post('/api/auth/register').send({
    company: name,
    name: 'Test Owner',
    email: randomUUID() + '@test.invalid',
    password: 'Only-for-local-test-1234',
  });
  assert.equal(r.status, 201);
  return { client, user: r.body.user, csrf: r.body.csrf };
}
test('monitoring alerts are scoped, durable, deduplicated and delivered to both roles', async (t) => {
  const company = await account('Monitoring Company'),
    government = await account('Authority');
  system.store.insert('government_admins', {
    user_id: government.user.id,
    authority: 'Government Oversight',
    demo_company_id: null,
  });
  let facilityId, ruleId, sampleId;
  await t.test(
    'anonymous visitors see city sources but not private monitoring or inboxes',
    async () => {
      assert.equal((await request(app).get('/api/public/india')).body.cities.length, 8);
      assert.equal((await request(app).get('/api/monitoring')).status, 401);
      const r = await company.client
        .post('/api/facilities')
        .set('X-CSRF-Token', company.csrf)
        .send({ name: 'Test factory', latitude: 17.38, longitude: 78.48, boundary: 'Test site' });
      assert.equal(r.status, 201);
      facilityId = r.body.id;
    },
  );
  await t.test('only an authorised government role configures a facility threshold', async () => {
    const body = {
      companyId: company.user.companyId,
      facilityId,
      metric: 'pm_stack',
      threshold: 50,
      unit: 'mg/Nm3',
      windowMinutes: 60,
      maxAgeMinutes: 180,
      measurementBasis: 'dry_normalised',
      sourceReference: 'Test operational reference; not a statutory claim',
    };
    assert.equal(
      (
        await company.client
          .post('/api/monitoring/rules')
          .set('X-CSRF-Token', company.csrf)
          .send(body)
      ).status,
      403,
    );
    const r = await government.client
      .post('/api/monitoring/rules')
      .set('X-CSRF-Token', government.csrf)
      .send(body);
    assert.equal(r.status, 201);
    ruleId = r.body.id;
  });
  await t.test(
    'a fresh reported exceedance creates in-app alerts for government and company',
    async () => {
      const finish = Date.now() - 60000,
        body = {
          facilityId,
          metric: 'pm_stack',
          value: 60,
          unit: 'mg/Nm3',
          periodStart: new Date(finish - 3600000).toISOString(),
          periodEnd: new Date(finish).toISOString(),
          measurementBasis: 'dry_normalised',
          quality: 'valid',
          sourceReference: 'Synthetic fixture source only',
          sourceKind: 'cems_verified',
        };
      const r = await company.client
        .post('/api/company/emissions')
        .set('X-CSRF-Token', company.csrf)
        .send(body);
      assert.equal(r.status, 201);
      sampleId = r.body.id;
      assert.equal(r.body.sourceKind, 'company_reported');
      const own = await company.client.get('/api/monitoring'),
        gov = await government.client.get('/api/monitoring');
      assert.equal(own.body.alerts.filter((a) => a.rule_id === ruleId).length, 1);
      assert.equal(
        own.body.notifications.filter((n) => n.kind === 'reported_emissions_threshold').length,
        1,
      );
      assert.equal(
        gov.body.notifications.filter((n) => n.kind === 'reported_emissions_threshold').length,
        1,
      );
      assert.equal(own.body.rules[0].assessment.legalFinding, false);
    },
  );
  await t.test('re-evaluation does not spam and missing data does not clear a breach', () => {
    const count = system.store.get('SELECT COUNT(*) n FROM notifications').n;
    system.monitoring.evaluateRules();
    system.monitoring.evaluateRules();
    assert.equal(system.store.get('SELECT COUNT(*) n FROM notifications').n, count);
    system.store.run('UPDATE emission_samples SET quality=? WHERE id=?', 'invalid', sampleId);
    system.monitoring.evaluateRules();
    assert.equal(
      system.store.get('SELECT status FROM monitoring_alerts WHERE rule_id=?', ruleId).status,
      'open',
    );
    system.store.run(
      'UPDATE emission_samples SET quality=?,value=? WHERE id=?',
      'valid',
      40,
      sampleId,
    );
    system.monitoring.evaluateRules();
    assert.equal(
      system.store.get('SELECT status FROM monitoring_alerts WHERE rule_id=?', ruleId).status,
      'resolved',
    );
  });
  await t.test('notification read access cannot cross accounts', async () => {
    const n = system.store.get('SELECT * FROM notifications WHERE user_id=?', company.user.id);
    assert.equal(
      (
        await government.client
          .patch('/api/notifications/' + n.id + '/read')
          .set('X-CSRF-Token', government.csrf)
          .send({})
      ).status,
      404,
    );
    assert.equal(
      (
        await company.client
          .patch('/api/notifications/' + n.id + '/read')
          .set('X-CSRF-Token', company.csrf)
          .send({})
      ).status,
      200,
    );
  });
  await t.test(
    'persistent polling retains last successful output and respects due times',
    async () => {
      system.store.run(
        'UPDATE metro_cache SET next_run=?',
        new Date(Date.now() + 3600000).toISOString(),
      );
      const city = INDIA_METROS[0];
      system.store.run(
        'UPDATE metro_cache SET next_run=? WHERE city_id=?',
        new Date(0).toISOString(),
        city.id,
      );
      let calls = 0;
      const poller = monitoringTools(system.store, config, system.ai, {
        model: async () => {
          calls++;
          return {
            air: { pm25: 10 },
            status: 'available',
            retrievedAt: now(),
            means: [],
            source: 'fixture',
          };
        },
        station: async () => ({ status: 'not_configured', records: [] }),
      });
      await poller.pollDue();
      assert.equal(calls, 1);
      await poller.pollDue();
      assert.equal(calls, 1);
      const first = system.store.get(
        'SELECT model_json FROM metro_cache WHERE city_id=?',
        city.id,
      ).model_json;
      system.store.run(
        'UPDATE metro_cache SET next_run=? WHERE city_id=?',
        new Date(0).toISOString(),
        city.id,
      );
      const failed = monitoringTools(system.store, config, system.ai, {
        model: async () => {
          throw Error('offline');
        },
        station: async () => ({ status: 'not_configured', records: [] }),
      });
      await failed.pollDue();
      assert.equal(
        system.store.get('SELECT model_json FROM metro_cache WHERE city_id=?', city.id).model_json,
        first,
      );
      assert.ok(system.store.get('SELECT error FROM metro_cache WHERE city_id=?', city.id).error);
    },
  );
});
test.after(() => {
  system.store.close();
  assert.ok(path.resolve(folder).startsWith(local + path.sep));
  fs.rmSync(folder, { recursive: true, force: true });
});
