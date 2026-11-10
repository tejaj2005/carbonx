import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../server/app.mjs';
import { openDatabase, uuid, now } from '../server/db.mjs';
const local = path.resolve('.local');
fs.mkdirSync(local, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(local, 'test-governance-'));
const config = {
  dataDir,
  aiEnabled: false,
  aiModel: '',
  embeddingModel: 'text-embedding-3-small',
  maxUpload: 1024 * 1024,
  secureCookies: false,
  allowDemo: true,
  allowRegistration: true,
  ocrEnabled: false,
  testing: true,
  production: false,
};
const system = await createApp(config),
  app = system.app;
async function register(name = 'Portal Test') {
  const client = request.agent(app),
    email = randomUUID() + '@test.invalid',
    password = 'Only-for-portal-tests-5678';
  const r = await client.post('/api/auth/register').send({
    company: name,
    name: 'Test Owner',
    email,
    password,
    role: 'government_admin',
    portal: 'government',
  });
  assert.equal(r.status, 201);
  return { client, email, password, csrf: r.body.csrf, user: r.body.user };
}
async function waitIdle() {
  for (let i = 0; i < 100; i++) {
    if (system.work.isIdle()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw Error('Demo pipeline did not finish');
}
test('government, company and public boundaries', async (t) => {
  const company = await register('Private Company'),
    authority = await register('Authority Test');
  await system.store.insert('government_admins', {
    user_id: authority.user.id,
    authority: 'Government Oversight',
    demo_company_id: null,
  });
  await t.test(
    'registration cannot grant government access; public reads need no sign-in',
    async () => {
      assert.equal(company.user.portal, 'company');
      assert.equal((await company.client.get('/api/government/overview')).status, 403);
      assert.equal((await request(app).get('/api/public/overview')).status, 200);
      assert.equal((await request(app).post('/api/company/submissions').send({})).status, 401);
      assert.equal((await authority.client.get('/api/government/overview')).status, 200);
      assert.equal((await authority.client.get('/api/claims')).status, 403);
    },
  );
  await t.test('government and company sign-in pages enforce the account portal', async () => {
    assert.equal(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: company.email, password: company.password, portal: 'government' })
      ).status,
      401,
    );
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: authority.email, password: authority.password, portal: 'government' });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.portal, 'government');
  });
  let submission;
  await t.test('company claims enter a separate government review queue', async () => {
    const r = await company.client
      .post('/api/company/submissions')
      .set('X-CSRF-Token', company.csrf)
      .send({
        text: 'Water consumption declined by 20% across all operations in FY2024.',
        year: 2024,
        source: 'Private report page 42',
      });
    assert.equal(r.status, 201);
    submission = r.body.id;
    const queue = await authority.client.get('/api/government/overview');
    assert.ok(queue.body.submissions.some((s) => s.id === submission));
    assert.equal(
      (
        await authority.client
          .patch('/api/government/submissions/' + submission)
          .set('X-CSRF-Token', authority.csrf)
          .send({
            status: 'follow_up',
            note: 'Please provide the matching historical water records.',
          })
      ).status,
      200,
    );
    const own = await company.client.get('/api/company/overview');
    assert.equal(own.body.submissions[0].status, 'follow_up');
  });
  await t.test(
    'licence actions are scoped, audited and enforce company writes immediately',
    async () => {
      const id = company.user.companyId;
      let r = await authority.client
        .patch('/api/government/companies/' + id + '/licence')
        .set('X-CSRF-Token', authority.csrf)
        .send({
          status: 'suspended',
          expectedStatus: 'pending',
          number: 'CX-TEST-1',
          reason: 'Evidence must be supplied before submissions can resume.',
        });
      assert.equal(r.status, 200);
      assert.equal(
        (await system.store.get('SELECT COUNT(*) n FROM oversight_actions WHERE company_id=?', id))
          .n,
        1,
      );
      assert.equal(
        (
          await company.client
            .post('/api/company/submissions')
            .set('X-CSRF-Token', company.csrf)
            .send({})
        ).status,
        403,
      );
      assert.equal(
        (await company.client.post('/api/team').set('X-CSRF-Token', company.csrf).send({})).status,
        403,
      );
      assert.equal(
        (
          await company.client
            .post('/api/reports/upload')
            .set('X-CSRF-Token', company.csrf)
            .send({})
        ).status,
        403,
      );
      assert.equal((await company.client.get('/api/company/overview')).status, 200);
      r = await authority.client
        .patch('/api/government/companies/' + id + '/licence')
        .set('X-CSRF-Token', authority.csrf)
        .send({
          status: 'active',
          expectedStatus: 'pending',
          reason: 'This stale update must be rejected safely.',
        });
      assert.equal(r.status, 409);
      r = await authority.client
        .patch('/api/government/companies/' + id + '/licence')
        .set('X-CSRF-Token', authority.csrf)
        .send({
          status: 'active',
          expectedStatus: 'suspended',
          reason: 'Evidence has now been reviewed and access is restored.',
        });
      assert.equal(r.status, 200);
      assert.ok(
        await system.store.get(
          "SELECT id FROM audit WHERE company_id=? AND action='licence.updated'",
          id,
        ),
      );
    },
  );
  await t.test(
    'publication is explicit and public responses exclude private evidence and accounts',
    async () => {
      let publicData = (await request(app).get('/api/public/overview')).body;
      assert.ok(!publicData.companies.some((c) => c.id === company.user.companyId));
      await system.store.insert('observations', {
        id: uuid('obs_'),
        company_id: company.user.companyId,
        facility_id: null,
        metric: 'water_consumption',
        value: 123,
        unit: 'kL',
        normalized_value: 123,
        normalized_unit: 'm3',
        year: 2024,
        boundary: 'Company-wide',
        source: 'DO-NOT-PUBLISH-SOURCE-PATH',
        report_id: null,
        created_at: now(),
      });
      let r = await company.client
        .patch('/api/company/publication')
        .set('X-CSRF-Token', company.csrf)
        .send({ visible: true, environment: false, description: 'Our published summary.' });
      assert.equal(r.status, 200);
      const reading = await company.client
        .post('/api/company/readings')
        .set('X-CSRF-Token', company.csrf)
        .send({
          metric: 'energy_consumption',
          value: 5000,
          unit: 'kWh',
          recordedAt: new Date().toISOString(),
          source: 'DO-NOT-PUBLISH-METER-ID',
        });
      assert.equal(reading.status, 201);
      publicData = (await request(app).get('/api/public/overview')).body;
      const record = publicData.companies.find((c) => c.id === company.user.companyId);
      assert.equal(record.metrics[0].value, 123);
      assert.equal(record.readings[0].value, 5);
      assert.equal(record.readings[0].unit, 'MWh');
      assert.deepEqual(record.environmental, []);
      const text = JSON.stringify(publicData);
      for (const secret of [
        company.email,
        'DO-NOT-PUBLISH-SOURCE-PATH',
        'DO-NOT-PUBLISH-METER-ID',
        'password_hash',
        'stored_name',
        'review_note',
        'latitude',
        'longitude',
      ])
        assert.ok(!text.includes(secret), secret);
      r = await authority.client
        .patch('/api/government/companies/' + company.user.companyId + '/publication')
        .set('X-CSRF-Token', authority.csrf)
        .send({ visible: false, environment: false, description: 'Hidden by authority.' });
      assert.equal(r.status, 200);
      assert.ok(
        !(await request(app).get('/api/public/overview')).body.companies.some(
          (c) => c.id === company.user.companyId,
        ),
      );
    },
  );
  await t.test(
    'government records cases, public notices and reversible access changes',
    async () => {
      let r = await authority.client
        .post('/api/government/actions')
        .set('X-CSRF-Token', authority.csrf)
        .send({
          companyId: company.user.companyId,
          type: 'request_evidence',
          note: 'Private follow-up asks for a complete source record.',
          publicNote: 'A supporting evidence review is in progress.',
        });
      assert.equal(r.status, 201);
      r = await authority.client
        .patch('/api/government/users/' + company.user.id)
        .set('X-CSRF-Token', authority.csrf)
        .send({ disabled: true, note: 'Temporarily disable this test account for access review.' });
      assert.equal(r.status, 200);
      assert.equal((await company.client.get('/api/auth/me')).status, 401);
      assert.equal(
        (
          await request(app)
            .post('/api/auth/login')
            .send({ email: company.email, password: company.password })
        ).status,
        401,
      );
      assert.equal(
        (
          await authority.client
            .patch('/api/government/users/' + company.user.id)
            .set('X-CSRF-Token', authority.csrf)
            .send({
              disabled: false,
              note: 'Account access review completed and access is restored.',
            })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(app)
            .post('/api/auth/login')
            .send({ email: company.email, password: company.password })
        ).status,
        200,
      );
    },
  );
  await t.test('government can create company records and company users', async () => {
    let r = await authority.client
      .post('/api/government/companies')
      .set('X-CSRF-Token', authority.csrf)
      .send({ name: 'Government Registered Test' });
    assert.equal(r.status, 201);
    const companyId = r.body.id;
    r = await authority.client
      .post('/api/government/users')
      .set('X-CSRF-Token', authority.csrf)
      .send({
        companyId,
        name: 'New Analyst',
        email: randomUUID() + '@test.invalid',
        password: 'Only-for-portal-tests-1234',
        role: 'analyst',
      });
    assert.equal(r.status, 201);
    assert.equal(
      (await system.store.get('SELECT role FROM users WHERE id=?', r.body.id)).role,
      'analyst',
    );
  });
  await t.test(
    'government demo cannot access any other company or create unrestricted accounts',
    async () => {
      const demo = request.agent(app),
        r = await demo.post('/api/auth/demo').send({ portal: 'government' });
      assert.equal(r.status, 201);
      const token = r.body.csrf;
      await waitIdle();
      assert.equal((await demo.get('/api/government/overview')).body.companies.length, 1);
      assert.equal(
        (await demo.get('/api/government/companies/' + company.user.companyId)).status,
        404,
      );
      assert.equal(
        (
          await demo
            .patch('/api/government/companies/' + company.user.companyId + '/licence')
            .set('X-CSRF-Token', token)
            .send({
              status: 'revoked',
              expectedStatus: 'active',
              reason: 'This cross-company demo mutation must be denied.',
            })
        ).status,
        404,
      );
      assert.equal(
        (
          await demo
            .post('/api/government/companies')
            .set('X-CSRF-Token', token)
            .send({ name: 'Not allowed' })
        ).status,
        403,
      );
      assert.equal(
        (
          await demo.post('/api/government/users').set('X-CSRF-Token', token).send({
            companyId: r.body.user.companyId,
            name: 'Invalid Demo',
            email: 'someone@example.com',
            password: 'Only-for-portal-tests-1234',
            role: 'owner',
          })
        ).status,
        400,
      );
    },
  );
  await t.test(
    'presentation role switching preserves the same isolated company and rejects real accounts',
    async () => {
      assert.equal(
        (
          await authority.client
            .post('/api/auth/demo-switch')
            .set('X-CSRF-Token', authority.csrf)
            .send({ portal: 'company' })
        ).status,
        403,
      );
      const demo = request.agent(app);
      let r = await demo.post('/api/auth/demo').send({ portal: 'company' });
      assert.equal(r.status, 201);
      const id = r.body.user.companyId,
        ownerId = r.body.user.id,
        token = r.body.csrf;
      await waitIdle();
      r = await demo
        .post('/api/auth/demo-switch')
        .set('X-CSRF-Token', token)
        .send({ portal: 'government' });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.portal, 'government');
      assert.equal(r.body.user.companyId, id);
      const governmentToken = r.body.csrf,
        governmentId = r.body.user.id;
      await system.store.insert('notifications', {
        id: uuid('notice_'),
        user_id: governmentId,
        event_key: 'test-demo-handoff',
        alert_id: null,
        title: 'Retained government notification',
        message: 'Synthetic test only',
        kind: 'workspace_event',
        created_at: now(),
        read_at: null,
      });
      assert.equal((await demo.get('/api/government/overview')).body.companies[0].id, id);
      r = await demo
        .post('/api/auth/demo-switch')
        .set('X-CSRF-Token', governmentToken)
        .send({ portal: 'company' });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.portal, 'company');
      assert.equal(r.body.user.companyId, id);
      assert.equal(r.body.user.id, ownerId);
      assert.equal((await demo.get('/api/government/overview')).status, 403);
      r = await demo
        .post('/api/auth/demo-switch')
        .set('X-CSRF-Token', r.body.csrf)
        .send({ portal: 'government' });
      assert.equal(r.status, 200);
      assert.equal(r.body.user.id, governmentId);
      assert.ok(
        (await demo.get('/api/monitoring')).body.notifications.some(
          (n) => n.event_key === 'test-demo-handoff',
        ),
      );
    },
  );
  await t.test('revoking authority takes effect on existing sessions', async () => {
    await system.store.run('DELETE FROM government_admins WHERE user_id=?', authority.user.id);
    assert.equal((await authority.client.get('/api/government/overview')).status, 403);
  });
  await t.test('a provisioning database connection does not interrupt live jobs', async () => {
    const id = uuid('job_');
    await system.store.insert('jobs', {
      id,
      company_id: company.user.companyId,
      report_id: null,
      type: 'atmosphere',
      status: 'running',
      progress: 20,
      stage: 'Fetching',
      error: null,
      created_at: now(),
      updated_at: now(),
    });
    const second = await openDatabase(dataDir, { recoverJobs: false });
    await second.close();
    assert.equal(
      (await system.store.get('SELECT status FROM jobs WHERE id=?', id)).status,
      'running',
    );
  });
});
test.after(async () => {
  await system.store.close();
  assert.ok(path.resolve(dataDir).startsWith(local + path.sep));
  fs.rmSync(dataDir, { recursive: true, force: true });
});
