import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import PDFDocument from 'pdfkit';
import { createApp } from '../server/app.mjs';
import { parseReport, chunkPages } from '../server/documents.mjs';
const local = path.resolve('.local');
fs.mkdirSync(local, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(local, 'test-'));
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
const system = createApp(config),
  app = system.app;
let owner, csrf, claims, reportId, other, otherCsrf;
async function idle() {
  for (let i = 0; i < 150; i++) {
    if (system.work.isIdle()) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw Error('Processing did not complete');
}
test('full company workflow and isolation', async (t) => {
  await t.test('example workspace creates real stored records and a processing job', async () => {
    owner = request.agent(app);
    const r = await owner.post('/api/auth/demo').send({});
    assert.equal(r.status, 201);
    csrf = r.body.csrf;
    assert.equal(r.body.user.isExample, true);
    await idle();
    const data = await owner.get('/api/claims');
    assert.equal(data.status, 200);
    claims = data.body;
    assert.ok(claims.length >= 4);
    reportId = claims[0].report_id;
    const water = claims.find((c) => c.metric === 'water_consumption');
    assert.equal(water.status, 'supported');
    assert.equal(claims.find((c) => c.metric === 'energy_consumption').status, 'needs_review');
    assert.equal(claims.find((c) => c.metric === 'emissions').status, 'insufficient_evidence');
  });
  await t.test('claim evidence contains an actual source quote and page', async () => {
    const r = await owner.get('/api/claims/' + claims[0].id);
    assert.equal(r.status, 200);
    assert.ok(r.body.source.page_number > 0);
    assert.ok(r.body.source.page_text.includes(r.body.text));
    assert.ok(r.body.retrieved.length);
  });
  await t.test('CSRF and origin checks reject unauthorised mutations', async () => {
    assert.equal((await owner.post('/api/facilities').send({})).status, 403);
    assert.equal(
      (
        await owner
          .post('/api/facilities')
          .set('X-CSRF-Token', csrf)
          .set('Origin', 'https://attacker.invalid')
          .send({})
      ).status,
      403,
    );
  });
  await t.test('a second company cannot access reports, claims or search results', async () => {
    other = request.agent(app);
    let r = await other.post('/api/auth/register').send({
      company: 'Isolation Test',
      name: 'Test Owner',
      email: randomUUID() + '@test.invalid',
      password: 'Only-for-local-testing-2468',
    });
    assert.equal(r.status, 201);
    otherCsrf = r.body.csrf;
    assert.equal((await other.get('/api/reports/' + reportId)).status, 404);
    assert.equal((await other.get('/api/claims/' + claims[0].id)).status, 404);
    r = await other
      .post('/api/retrieval/search')
      .set('X-CSRF-Token', otherCsrf)
      .send({ query: 'water consumption' });
    assert.deepEqual(r.body.passages, []);
  });
  await t.test('upload validates signatures and processes a text source', async () => {
    const bad = await other
      .post('/api/reports/upload')
      .set('X-CSRF-Token', otherCsrf)
      .field('name', 'Invalid PDF')
      .field('year', '2024')
      .field('boundary', 'All company operations')
      .attach('report', Buffer.from('not a PDF'), 'invalid.pdf');
    assert.equal(bad.status, 400);
    const r = await other
      .post('/api/reports/upload')
      .set('X-CSRF-Token', otherCsrf)
      .field('name', 'Text test report')
      .field('year', '2024')
      .field('boundary', 'All company operations')
      .attach(
        'report',
        Buffer.from('In FY2024, renewable energy share reached 40% across all company operations.'),
        'report.txt',
      );
    assert.equal(r.status, 202);
    await idle();
    const list = await other.get('/api/claims');
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].status, 'insufficient_evidence');
  });
  await t.test('review decisions persist separately from automatic evidence status', async () => {
    const c = claims[0];
    const r = await owner
      .post('/api/claims/' + c.id + '/review')
      .set('X-CSRF-Token', csrf)
      .send({
        decision: 'follow_up',
        rationale: 'Please confirm the original reporting scope before accepting this claim.',
      });
    assert.equal(r.status, 200);
    const detail = await owner.get('/api/claims/' + c.id);
    assert.equal(detail.body.review_state, 'follow_up');
    assert.equal(detail.body.reviews.length, 1);
  });
  await t.test('analysts cannot record reviewer decisions', async () => {
    const email = randomUUID() + '@test.invalid';
    let r = await owner
      .post('/api/team')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Analyst', email, password: 'Only-for-local-testing-3579', role: 'analyst' });
    assert.equal(r.status, 201);
    const analyst = request.agent(app);
    r = await analyst
      .post('/api/auth/login')
      .send({ email, password: 'Only-for-local-testing-3579' });
    assert.equal(r.status, 200);
    assert.equal(
      (
        await analyst
          .post('/api/claims/' + claims[0].id + '/review')
          .set('X-CSRF-Token', r.body.csrf)
          .send({ decision: 'accepted', rationale: 'A role boundary test.' })
      ).status,
      403,
    );
  });
  await t.test(
    'CSV import previews, rejects duplicates atomically and stores valid observations',
    async () => {
      const csv =
        'metric,value,unit,year,boundary,facilityId,source\nwater_consumption,500,kL,2024,All company operations,,Test source page 1';
      let r = await other
        .post('/api/history/import')
        .set('X-CSRF-Token', otherCsrf)
        .send({ csv, confirm: false });
      assert.equal(r.status, 200);
      assert.equal((await other.get('/api/history')).body.length, 0);
      r = await other
        .post('/api/history/import')
        .set('X-CSRF-Token', otherCsrf)
        .send({ csv, confirm: true });
      assert.equal(r.status, 201);
      r = await other
        .post('/api/history/import')
        .set('X-CSRF-Token', otherCsrf)
        .send({ csv, confirm: true });
      assert.equal(r.status, 409);
      assert.equal((await other.get('/api/history')).body.length, 1);
    },
  );
  await t.test('exports contain current stored findings', async () => {
    const csv = await owner.get('/api/export/csv');
    assert.equal(csv.status, 200);
    assert.ok(csv.text.includes('Riverbend'));
    const json = await owner.get('/api/export/json');
    assert.equal(json.body.isExample, true);
    assert.equal(json.body.claims.length, claims.length);
    const pdf = await owner.get('/api/export/pdf');
    assert.equal(pdf.status, 200);
    assert.ok(Buffer.from(pdf.body).subarray(0, 5).toString().startsWith('%PDF'));
  });
  await t.test('evaluation needs labels, then reports measured values', async () => {
    let r = await owner.post('/api/evaluations/run').set('X-CSRF-Token', csrf).send({});
    assert.equal(r.status, 400);
    const c = claims.find((c) => c.metric === 'water_consumption');
    r = await owner
      .post('/api/evaluations/labels')
      .set('X-CSRF-Token', csrf)
      .send({
        claimId: c.id,
        expectedStatus: 'supported',
        expectedSdgs: [6, 12],
        relevantChunkIds: [c.chunk_id],
        split: 'test',
      });
    assert.equal(r.status, 201);
    r = await owner.post('/api/evaluations/run').set('X-CSRF-Token', csrf).send({});
    assert.equal(r.status, 200);
    assert.equal(r.body.metrics.testCases, 1);
    assert.equal(r.body.metrics.claimStatus.accuracy, 1);
  });
  await t.test('password changes verify the old password and revoke other sessions', async () => {
    const email = randomUUID() + '@test.invalid',
      first = request.agent(app),
      second = request.agent(app);
    let r = await first.post('/api/auth/register').send({
      company: 'Password Test',
      name: 'Password Tester',
      email,
      password: 'Old-local-password-1234',
    });
    const token = r.body.csrf;
    await second.post('/api/auth/login').send({ email, password: 'Old-local-password-1234' });
    r = await first
      .post('/api/auth/password')
      .set('X-CSRF-Token', token)
      .send({ currentPassword: 'wrong', newPassword: 'New-local-password-5678' });
    assert.equal(r.status, 400);
    r = await first
      .post('/api/auth/password')
      .set('X-CSRF-Token', token)
      .send({ currentPassword: 'Old-local-password-1234', newPassword: 'New-local-password-5678' });
    assert.equal(r.status, 200);
    assert.equal((await second.get('/api/auth/me')).status, 401);
    assert.equal((await first.get('/api/auth/me')).status, 200);
    assert.equal(
      (
        await request
          .agent(app)
          .post('/api/auth/login')
          .send({ email, password: 'Old-local-password-1234' })
      ).status,
      401,
    );
    assert.equal(
      (
        await request
          .agent(app)
          .post('/api/auth/login')
          .send({ email, password: 'New-local-password-5678' })
      ).status,
      200,
    );
  });
  await t.test('PDF extraction preserves physical page references', async () => {
    const file = path.join(dataDir, 'parser-fixture.pdf');
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument(),
        out = fs.createWriteStream(file);
      doc.pipe(out);
      doc.text('Water consumption decreased by 20% in FY2024 compared with FY2023.');
      doc.addPage();
      doc.text('In FY2024, energy consumption reached 100 MWh.');
      doc.end();
      out.on('finish', resolve);
      out.on('error', reject);
    });
    const parsed = await parseReport(file, config);
    assert.equal(parsed.pages.length, 2);
    assert.equal(parsed.pages[1].number, 2);
    assert.ok(parsed.pages[1].text.includes('100 MWh'));
    assert.ok(
      chunkPages(
        parsed.pages.map((p, i) => ({ ...p, id: 'p' + i })),
        'company',
        'report',
      ).length >= 2,
    );
  });
});
test.after(() => {
  system.store.close();
  assert.ok(path.resolve(dataDir).startsWith(local + path.sep));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('environment reads remain available during polling and job limits return JSON', async () => {
  const folder = fs.mkdtempSync(path.join(local, 'test-limits-'));
  const limited = createApp({ ...config, dataDir: folder, testing: false });
  try {
    const client = request.agent(limited.app);
    const registration = await client.post('/api/auth/register').send({
      company: 'Polling Test',
      name: 'Polling Tester',
      email: randomUUID() + '@test.invalid',
      password: 'Only-for-local-testing-8642',
    });
    assert.equal(registration.status, 201);
    for (let i = 0; i < 12; i++) assert.equal((await client.get('/api/environment')).status, 200);
    let response;
    for (let i = 0; i < 9; i++)
      response = await client
        .post('/api/environment/weather')
        .set('X-CSRF-Token', registration.body.csrf)
        .send({});
    assert.equal(response.status, 429);
    assert.ok(response.body.error.includes('Too many provider jobs'));
    assert.equal((await client.get('/api/environment')).status, 200);
  } finally {
    limited.store.close();
    assert.ok(path.resolve(folder).startsWith(local + path.sep));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
