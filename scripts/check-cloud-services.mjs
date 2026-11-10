import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { config } from '../server/config.mjs';
import { cloudServices } from '../server/cloud-services.mjs';
const cloud = cloudServices({
  ...config,
  authBackend: 'supabase',
  storageBackend: 'supabase',
  testing: false,
});
const suffix = crypto.randomUUID(),
  password = crypto.randomBytes(24).toString('base64url'),
  email = 'carbonx-verification-' + suffix + '@example.com';
const bytes = Buffer.from('CarbonX synthetic private-storage connectivity test.');
const report = {
  company_id: 'probe_' + suffix,
  stored_name: suffix + '.txt',
  mime: 'text/plain',
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
};
let id,
  stored = false;
const checks = [];
try {
  await cloud.ensureBucket();
  checks.push({ service: 'Private evidence bucket', status: 'verified' });
  await cloud.saveOriginal(report, bytes);
  stored = true;
  assert.deepEqual(await cloud.download(report), bytes);
  checks.push({ service: 'Private upload and checksum-verified download', status: 'passed' });
  id = await cloud.provision(email, password, 'Temporary CarbonX connection check');
  const user = {
    email,
    name: 'Temporary CarbonX connection check',
    auth_user_id: id,
    is_example: 0,
  };
  assert.equal(await cloud.authenticate(user, password), id);
  await cloud.checkIdentity(user);
  checks.push({ service: 'Supabase Auth create/sign-in/identity check', status: 'passed' });
  const next = crypto.randomBytes(24).toString('base64url');
  await cloud.changePassword(user, password, next);
  assert.equal(await cloud.authenticate(user, next), id);
  checks.push({ service: 'Supabase Auth password update', status: 'passed' });
} catch (e) {
  checks.push({ service: 'Cloud verification', status: 'FAILED', reason: e.message });
  process.exitCode = 1;
} finally {
  if (stored)
    try {
      await cloud.request(
        '/storage/v1/object/' + (process.env.SUPABASE_STORAGE_BUCKET || 'carbonx-evidence'),
        { method: 'DELETE', json: { prefixes: [report.company_id + '/' + report.stored_name] } },
      );
      checks.push({ service: 'Synthetic object cleanup', status: 'done' });
    } catch {
      checks.push({ service: 'Synthetic object cleanup', status: 'failed' });
      process.exitCode = 1;
    }
  if (id)
    try {
      await cloud.request('/auth/v1/admin/users/' + id, { method: 'DELETE' });
      checks.push({ service: 'Synthetic identity cleanup', status: 'done' });
    } catch {
      checks.push({ service: 'Synthetic identity cleanup', status: 'failed' });
      process.exitCode = 1;
    }
  console.table(checks);
}
