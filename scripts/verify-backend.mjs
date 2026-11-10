import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { config } from '../server/config.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/auth.mjs';
import { cloudServices } from '../server/cloud-services.mjs';
import { uuid, now } from '../server/db.mjs';
const local = path.resolve('.local'),
  dataDir = fs.mkdtempSync(path.join(local, 'live-backend-check-'));
const cfg = {
  ...config,
  dataDir,
  databaseBackend: 'sqlite',
  authBackend: 'supabase',
  storageBackend: 'supabase',
  testing: false,
  aiEnabled: false,
  allowDemo: false,
  allowRegistration: false,
  monitoringEnabled: false,
  secureCookies: false,
};
const cloud = cloudServices(cfg),
  password = crypto.randomBytes(24).toString('base64url'),
  email = 'carbonx-app-check-' + crypto.randomUUID() + '@example.com',
  company = uuid('org_'),
  user = uuid('usr_');
let authId, system, server, report;
try {
  authId = await cloud.provision(email, password, 'Synthetic backend verifier');
  system = await createApp(cfg);
  system.app.use(system.errorHandler);
  await system.store.insert('companies', {
    id: company,
    name: 'Temporary backend verification fixture',
    is_example: 0,
    created_at: now(),
  });
  await system.store.insert('users', {
    id: user,
    company_id: company,
    email,
    name: 'Synthetic verifier',
    password_hash: await hashPassword(password),
    auth_user_id: authId,
    role: 'owner',
    created_at: now(),
  });
  server = system.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  let r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email, password, portal: 'company' }),
  });
  assert.equal(r.status, 200);
  const signed = await r.json(),
    cookie = r.headers
      .getSetCookie()
      .find((x) => x.startsWith('carbonx_session='))
      .split(';')[0];
  const headers = { cookie, origin: base, 'X-CSRF-Token': signed.csrf };
  r = await fetch(base + '/api/auth/me', { headers });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).user.id, user);
  r = await fetch(base + '/api/auth/profile', {
    method: 'PATCH',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Verified synthetic profile' }),
  });
  assert.equal(r.status, 200);
  const bytes = Buffer.from(
    'Synthetic backend test. Scope 1 emissions were 120 tCO2e in 2025. This is invented test evidence.',
  );
  const form = new FormData();
  form.set('name', 'Synthetic backend verification');
  form.set('year', '2025');
  form.set('boundary', 'Synthetic boundary');
  form.set('report', new Blob([bytes], { type: 'text/plain' }), 'synthetic-test.txt');
  r = await fetch(base + '/api/reports/upload', { method: 'POST', headers, body: form });
  assert.equal(r.status, 202);
  report = (await r.json()).report;
  for (let i = 0; i < 120 && !system.work.isIdle(); i++)
    await new Promise((resolve) => setTimeout(resolve, 250));
  assert(system.work.isIdle());
  const stored = await system.store.get('SELECT status FROM reports WHERE id=?', report.id);
  assert.equal(stored.status, 'ready');
  r = await fetch(base + '/api/reports/' + report.id + '/file', { headers });
  assert.equal(r.status, 200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), bytes);
  console.log({
    cloudAuthLogin: 'passed',
    cloudIdentityCheck: 'passed',
    profileUpdate: 'passed',
    privateUpload: 'passed',
    reportProcessing: 'passed',
    protectedCloudDownload: 'passed',
    metadataBackend: 'isolated SQLite fixture',
    emailSent: false,
  });
} finally {
  if (system) {
    for (let i = 0; i < 120 && !system.work.isIdle(); i++)
      await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  if (report)
    await cloud.request(
      '/storage/v1/object/' + (process.env.SUPABASE_STORAGE_BUCKET || 'carbonx-evidence'),
      { method: 'DELETE', json: { prefixes: [report.company_id + '/' + report.stored_name] } },
    );
  if (authId) await cloud.request('/auth/v1/admin/users/' + authId, { method: 'DELETE' });
  if (system) await system.store.close();
  if (path.resolve(dataDir).startsWith(local + path.sep))
    fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('Temporary verification account, object and local fixture cleaned up.');
}
