import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../server/app.mjs';
import { demoTools } from '../server/demo.mjs';
const dataDir = fs.mkdtempSync(path.resolve('.local/demo-test-'));
const system = await createApp({
  dataDir,
  aiEnabled: false,
  aiModel: '',
  embeddingModel: '',
  maxUpload: 1048576,
  secureCookies: false,
  allowDemo: true,
  allowRegistration: true,
  ocrEnabled: false,
  testing: true,
  expandedDemo: true,
  production: false,
});
const { app, store } = system;
async function demo(portal = 'company') {
  const client = request.agent(app),
    result = await client.post('/api/auth/demo').send({ portal });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  for (let i = 0; i < 100 && !system.work.isIdle(); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.ok(system.work.isIdle());
  return { client, ...result.body };
}
test('presentation dataset fills the public, company and government workflows without crossing sandboxes', async () => {
  const a = await demo(),
    b = await demo('government');
  const company = (await a.client.get('/api/company/overview')).body;
  assert.equal(company.readings.length, 18);
  assert.equal(company.submissions.length, 5);
  assert.ok(company.submissions.some((s) => s.status === 'accepted'));
  assert.ok(company.submissions.some((s) => s.status === 'follow_up'));
  assert.equal(company.actions.length, 2);
  const dashboard = (await a.client.get('/api/dashboard')).body;
  assert.equal(dashboard.stats.reports, 3);
  assert.ok(dashboard.stats.claims >= 12);
  const history = (await a.client.get('/api/history')).body;
  assert.equal(history.length, 22);
  assert.deepEqual(
    [...new Set(history.filter((h) => h.metric === 'water_consumption').map((h) => h.year))].sort(),
    [2022, 2023, 2024, 2025],
  );
  const before = await store.get(
    'SELECT COUNT(*) n FROM observations WHERE company_id=?',
    a.user.companyId,
  );
  await a.client.get('/api/auth/me');
  await a.client.get('/api/auth/me');
  assert.equal(
    (await store.get('SELECT COUNT(*) n FROM observations WHERE company_id=?', a.user.companyId)).n,
    before.n,
  );
  const reports = (await a.client.get('/api/reports')).body;
  const report = reports.find((r) => r.mode === 'synthetic-fixture');
  assert.ok(report);
  const source = await a.client.get('/api/reports/' + report.id + '/file?download=1');
  assert.equal(source.status, 200);
  assert.match(source.text, /SYNTHETIC PRESENTATION/);
  const monitoring = (await a.client.get('/api/monitoring')).body;
  assert.equal(monitoring.rules.length, 3);
  assert.equal(monitoring.rules.filter((r) => r.assessment.status === 'above_threshold').length, 1);
  assert.ok(monitoring.rules.every((r) => r.sample.source_kind === 'synthetic_example'));
  assert.ok(monitoring.notifications.length >= 2);
  const evaluation = (await a.client.get('/api/evaluations')).body;
  assert.equal(evaluation.cases.length, 3);
  assert.equal(evaluation.runs.length, 1);
  const gov = (await b.client.get('/api/government/overview')).body;
  assert.equal(gov.companies.length, 4);
  assert.equal(gov.stats.suspended, 1);
  assert.ok(gov.actions.length >= 8);
  assert.ok(gov.users.length >= 12);
  assert.equal((await b.client.get('/api/government/companies/' + a.user.companyId)).status, 404);
  const gm = (await b.client.get('/api/monitoring')).body;
  assert.equal(gm.rules.length, 12);
  assert.equal(gm.facilities.length, 4);
  const hiddenRule = monitoring.rules[0];
  assert.equal(
    (
      await b.client
        .patch('/api/monitoring/rules/' + hiddenRule.id)
        .set('X-CSRF-Token', b.csrf)
        .send({ active: false })
    ).status,
    404,
  );
  const other = gov.companies.find((c) => c.id !== b.user.companyId);
  assert.equal((await b.client.get('/api/government/companies/' + other.id)).status, 200);
  const oldStatus = await store.get(
    'SELECT status FROM submissions WHERE company_id=? AND status=?',
    other.id,
    'under_review',
  );
  assert.equal(oldStatus.status, 'under_review');
  const submission = gov.submissions.find(
    (s) => s.company_id === other.id && s.status === 'under_review',
  );
  assert.equal(
    (
      await b.client
        .patch('/api/government/submissions/' + submission.id)
        .set('X-CSRF-Token', b.csrf)
        .send({ status: 'accepted', note: 'Synthetic reviewer walkthrough decision retained.' })
    ).status,
    200,
  );
  await b.client.get('/api/auth/me');
  assert.equal(
    (await store.get('SELECT status FROM submissions WHERE id=?', submission.id)).status,
    'accepted',
  );
  const exported = await b.client.get('/api/government/export/json');
  assert.equal(exported.status, 200);
  assert.equal(exported.body.companies.length, 4);
  for (const format of ['docx', 'xlsx']) {
    const file = await a.client.get('/api/company/export/' + format);
    assert.equal(file.status, 200);
    assert.ok(Number(file.headers['content-length']) > 1000);
  }
  const switched = await a.client
    .post('/api/auth/demo-switch')
    .set('X-CSRF-Token', a.csrf)
    .send({ portal: 'government' });
  assert.equal(switched.status, 200);
  const inbox = (await a.client.get('/api/monitoring')).body.notifications;
  assert.ok(
    inbox.some((n) => n.alert_id),
    'Existing open alerts reach the newly created government role',
  );
  const again = (await a.client.get('/api/monitoring')).body.notifications;
  assert.equal(
    again.length,
    inbox.length,
    'Repeated monitoring reads do not duplicate notifications',
  );
  const publicData = (await request(app).get('/api/public/overview')).body;
  assert.equal(publicData.companies.length, 4);
  assert.ok(
    publicData.companies.every(
      (c) => c.isExample && c.metrics.length >= 6 && c.readings.length === 18,
    ),
  );
  const publicText = JSON.stringify(publicData);
  for (const secret of [
    'password_hash',
    '@carbonx.invalid',
    'review_note',
    'latitude',
    'longitude',
  ])
    assert.ok(!publicText.includes(secret), secret);
});
test('fresh public bootstrap is complete and never overrides private publication or real records', async () => {
  const folder = fs.mkdtempSync(path.resolve('.local/demo-bootstrap-'));
  const config = {
    dataDir: folder,
    aiEnabled: false,
    aiModel: '',
    embeddingModel: '',
    maxUpload: 1048576,
    secureCookies: false,
    allowDemo: true,
    allowRegistration: true,
    ocrEnabled: false,
    testing: false,
    production: false,
    monitoringEnabled: false,
  };
  let current = await createApp(config);
  try {
    let data = (await request(current.app).get('/api/public/overview')).body;
    assert.equal(data.companies.length, 4);
    assert.ok(data.companies.every((c) => c.metrics.length === 6 && c.readings.length === 18));
    const root = data.companies.find((c) => c.name === 'Riverbend Example Company').id;
    await current.store.run(
      'UPDATE company_registry SET public_visible=0 WHERE company_id=?',
      root,
    );
    await current.store.close();
    current = await createApp(config);
    data = (await request(current.app).get('/api/public/overview')).body;
    assert.equal(data.companies.length, 4);
    assert.ok(data.companies.every((c) => c.metrics.length === 6 && c.readings.length === 18));
    assert.ok(!data.companies.some((c) => c.id === root));
    assert.equal(
      (
        await current.store.get(
          'SELECT public_visible FROM company_registry WHERE company_id=?',
          root,
        )
      ).public_visible,
      0,
    );
    const r = await request(current.app).post('/api/auth/register').send({
      company: 'Real records must stay empty',
      name: 'Test Owner',
      email: 'real-fixture@test.invalid',
      password: 'Not-a-real-password-9837',
    });
    assert.equal(r.status, 201);
    await assert.rejects(
      demoTools(current.store, config, current.work).seed(r.body.user.companyId),
      /only be added to a synthetic/,
    );
    assert.equal(
      (
        await current.store.get(
          'SELECT COUNT(*) n FROM observations WHERE company_id=?',
          r.body.user.companyId,
        )
      ).n,
      0,
    );
  } finally {
    await current.monitoring.stop();
    await current.store.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
test.after(async () => {
  await system.monitoring.stop();
  await store.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
