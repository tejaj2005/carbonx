import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import { parse } from 'csv-parse/sync';
import { createApp } from '../server/app.mjs';
const root = path.resolve('.local');
fs.mkdirSync(root, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(root, 'test-status-exports-'));
const system = createApp({
    dataDir,
    aiEnabled: false,
    maxUpload: 1024 * 1024,
    secureCookies: false,
    allowDemo: true,
    allowRegistration: true,
    ocrEnabled: false,
    testing: true,
    production: false,
  }),
  { app, store } = system;
const binary = (res, done) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};
async function idle() {
  for (let i = 0; i < 200; i++) {
    if (system.work.isIdle()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw Error('Pipeline not idle');
}
test('role-scoped company and government status exports', async (t) => {
  const a = request.agent(app),
    b = request.agent(app),
    gov = request.agent(app);
  const ar = await a.post('/api/auth/demo').send({}),
    br = await b.post('/api/auth/demo').send({});
  assert.equal(ar.status, 201);
  assert.equal(br.status, 201);
  await idle();
  const aid = ar.body.user.companyId,
    bid = br.body.user.companyId;
  store.run('UPDATE companies SET name=? WHERE id=?', 'Private B export sentinel', bid);
  const gr = await gov.post('/api/auth/register').send({
    company: 'Export Authority',
    name: 'Export Administrator',
    email: randomUUID() + '@test.invalid',
    password: 'Export-tests-only-9876',
  });
  store.insert('government_admins', {
    user_id: gr.body.user.id,
    authority: 'Government Oversight',
    demo_company_id: null,
  });
  const report = store.get('SELECT id FROM reports WHERE company_id=?', aid);
  await t.test('anonymous and company accounts cannot use government downloads', async () => {
    assert.equal((await request(app).get('/api/government/export/json')).status, 401);
    assert.equal((await a.get('/api/government/export/json')).status, 403);
    assert.equal((await a.get('/api/government/companies/' + aid + '/export/pdf')).status, 403);
  });
  await t.test(
    'overall status matches scoped companies and keeps summary counts explicit',
    async () => {
      const r = await gov.get('/api/government/export/json');
      assert.equal(r.status, 200);
      assert.equal(r.body.summary.companies, 2);
      assert.equal(r.body.summary.active_reports, 2);
      assert.deepEqual(new Set(r.body.companies.map((c) => c.id)), new Set([aid, bid]));
      assert.ok(r.body.companies.every((c) => c.is_example));
      assert.match(r.headers['content-disposition'], /attachment.*json/);
      assert.equal(r.headers['cache-control'], 'private, no-store');
    },
  );
  await t.test(
    'company detail exports preserve evidence, reviews, status and source references without secrets',
    async () => {
      const r = await gov.get('/api/government/companies/' + aid + '/export/json');
      assert.equal(r.status, 200);
      assert.equal(r.body.reports.length, 1);
      assert.equal(r.body.claims.length, 5);
      assert.ok(r.body.claims.every((c) => Array.isArray(c.sdgs)));
      assert.equal(r.body.submissions[0].status, 'submitted');
      assert.equal(r.body.observations.length, 4);
      assert.equal(r.body.observations[0].facility_name, 'Example Riverbend Works');
      const original = await gov.get(
        '/api/government/companies/' + aid + '/reports/' + report.id + '/file?download=1',
      );
      assert.equal(original.status, 200);
      assert.match(
        original.headers['content-disposition'],
        /attachment.*synthetic-example-report.txt/,
      );
      assert.match(original.text, /SYNTHETIC EXAMPLE REPORT/);
      assert.ok(r.body.claims.every((c) => c.report_id === report.id && c.page_number > 0));
      const json = JSON.stringify(r.body);
      for (const forbidden of [
        'password_hash',
        'stored_name',
        'carbonx_session',
        'csrf',
        'Private B export sentinel',
      ])
        assert.ok(!json.includes(forbidden));
      assert.equal(
        (
          await gov.get(
            '/api/government/companies/' + aid + '/reports/' + report.id + '/export/json',
          )
        ).body.claims.length,
        5,
      );
      assert.equal(
        (
          await gov.get(
            '/api/government/companies/' + bid + '/reports/' + report.id + '/export/json',
          )
        ).status,
        404,
      );
    },
  );
  await t.test(
    'own-company exports cannot be redirected to another company with query parameters',
    async () => {
      const r = await a.get('/api/company/export/json?companyId=' + bid);
      assert.equal(r.status, 200);
      assert.equal(r.body.company.id, aid);
      assert.ok(!JSON.stringify(r.body).includes('Private B export sentinel'));
      assert.equal((await gov.get('/api/company/export/json')).status, 403);
      assert.equal((await a.get('/api/company/export/exe')).status, 400);
    },
  );
  await t.test(
    'owner, analyst and reviewer can read own exports even while licence is suspended',
    async () => {
      for (const role of ['analyst', 'reviewer']) {
        const email = randomUUID() + '@test.invalid',
          password = 'Export-role-only-9876';
        const added = await a
          .post('/api/team')
          .set('X-CSRF-Token', ar.body.csrf)
          .send({ name: 'Export ' + role, email, password, role });
        assert.equal(added.status, 201);
        const client = request.agent(app);
        assert.equal((await client.post('/api/auth/login').send({ email, password })).status, 200);
        assert.equal((await client.get('/api/company/export/json')).body.company.id, aid);
        assert.equal((await client.get('/api/government/export/json')).status, 403);
      }
      store.run("UPDATE company_registry SET licence_status='suspended' WHERE company_id=?", aid);
      assert.equal(
        (await a.get('/api/company/export/json')).body.registry.licence_status,
        'suspended',
      );
    },
  );
  await t.test(
    'PDF is a real readable report and CSV neutralizes spreadsheet formula cells',
    async () => {
      const r = await gov
        .get('/api/government/companies/' + aid + '/export/pdf')
        .buffer(true)
        .parse(binary);
      assert.equal(r.status, 200);
      assert.equal(r.body.subarray(0, 5).toString(), '%PDF-');
      const doc = new PDFParse({ data: r.body });
      const text = (await doc.getText()).text;
      await doc.destroy();
      assert.match(text, /Company status report/);
      assert.match(text, /SYNTHETIC EXAMPLE/);
      assert.match(text, /water consumption/);
      store.run('UPDATE companies SET name=? WHERE id=?', '=EXTERNAL_FORMULA()', bid);
      const csv = await gov.get('/api/government/export/csv');
      assert.equal(csv.status, 200);
      const rows = parse(csv.text, { columns: true });
      assert.ok(rows.some((r) => r.field === 'name' && r.value === "'=EXTERNAL_FORMULA()"));
      assert.equal((await a.get('/api/company/export/csv')).status, 200);
      const summaryPdf = await gov.get('/api/government/export/pdf').buffer(true).parse(binary);
      assert.equal(summaryPdf.body.subarray(0, 5).toString(), '%PDF-');
      const findings = await gov
        .get('/api/government/companies/' + aid + '/reports/' + report.id + '/export/pdf')
        .buffer(true)
        .parse(binary);
      assert.equal(findings.body.subarray(0, 5).toString(), '%PDF-');
    },
  );
  await t.test(
    'Word and Excel exports are genuine structured files with role-scoped data',
    async () => {
      const facility = store.get('SELECT id FROM facilities WHERE company_id=?', aid);
      store.insert('emission_samples', {
        id: 'export-sample',
        company_id: aid,
        facility_id: facility.id,
        metric: 'emissions',
        value: 12,
        unit: 'tCO2e',
        period_start: '2026-10-01T00:00:00Z',
        period_end: '2026-10-31T23:59:59Z',
        measurement_basis: 'Synthetic operational boundary',
        quality: 'valid',
        source_kind: 'company_reported',
        source_reference: 'Synthetic monitoring source for export test',
        created_at: new Date().toISOString(),
      });
      for (const [client, url] of [
        [a, '/api/company/export'],
        [gov, '/api/government/companies/' + aid + '/export'],
        [gov, '/api/government/export'],
        [gov, '/api/government/companies/' + aid + '/reports/' + report.id + '/export'],
        [a, '/api/export'],
      ]) {
        const suffix = url === '/api/export' ? '?reportId=' + report.id : '';
        const word = await client
          .get(url + '/docx' + suffix)
          .buffer(true)
          .parse(binary);
        assert.equal(word.status, 200);
        assert.match(word.headers['content-type'], /wordprocessingml/);
        const extracted = await mammoth.extractRawText({ buffer: word.body });
        assert.match(extracted.value, /Summary/);
        if (
          url === '/api/company/export' ||
          url === '/api/government/companies/' + aid + '/export'
        ) {
          assert.match(extracted.value, /Synthetic operational boundary/);
          assert.match(extracted.value, /2026-10-01T00:00:00Z/);
          assert.match(extracted.value, /2026-10-31T23:59:59Z/);
        }
        if (!url.endsWith('/government/export'))
          assert.ok(!extracted.value.includes('=EXTERNAL_FORMULA()'));
        const excel = await client
          .get(url + '/xlsx' + suffix)
          .buffer(true)
          .parse(binary);
        assert.equal(excel.status, 200);
        assert.match(excel.headers['content-type'], /spreadsheetml/);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(excel.body);
        assert.ok(wb.getWorksheet('Summary'));
        assert.equal(wb.getWorksheet('Summary').getCell('A6').value, 'Measure');
        const findings = wb.getWorksheet('Report findings');
        if (findings) {
          assert.equal(findings.getRow(6).getCell(4).value, 'Status');
          assert.equal(findings.getRow(7).getCell(2).type, ExcelJS.ValueType.Number);
          assert.equal(findings.views[0].state, 'frozen');
        }
        const companies = wb.getWorksheet('Company status');
        if (companies) {
          const nameCol = companies.getRow(6).values.indexOf('Name');
          const cell = companies
            .getRows(7, companies.rowCount - 6)
            .map((r) => r.getCell(nameCol))
            .find((c) => c.value === '=EXTERNAL_FORMULA()');
          assert.equal(cell.type, ExcelJS.ValueType.String);
        }
      }
      assert.equal((await b.get('/api/government/export/xlsx')).status, 403);
      assert.equal(
        (
          await a.get(
            '/api/export/docx?reportId=' +
              store.get('SELECT id FROM reports WHERE company_id=?', bid).id,
          )
        ).status,
        404,
      );
    },
  );

  await t.test(
    'demo authority exports stay within its one synthetic company and revocation takes effect',
    async () => {
      const demo = request.agent(app),
        r = await demo.post('/api/auth/demo').send({ portal: 'government' });
      assert.equal(r.status, 201);
      await idle();
      const scopedReport = await demo.get('/api/government/export/json');
      assert.equal(scopedReport.body.companies.length, 1);
      assert.equal(scopedReport.body.companies[0].id, r.body.user.companyId);
      assert.equal(
        (await demo.get('/api/government/companies/' + aid + '/export/json')).status,
        404,
      );
      assert.equal(
        (
          await demo.get(
            '/api/government/companies/' + aid + '/reports/' + report.id + '/export/json',
          )
        ).status,
        404,
      );
      store.run('DELETE FROM government_admins WHERE user_id=?', gr.body.user.id);
      assert.equal((await gov.get('/api/government/export/json')).status, 403);
    },
  );
  assert.ok(store.q("SELECT * FROM audit WHERE action LIKE '%exported'").length > 0);
});
test.after(() => {
  store.close();
});
