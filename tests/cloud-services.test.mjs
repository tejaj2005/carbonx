import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { cloudServices } from '../server/cloud-services.mjs';
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'fixture-server-key',
};
test('private storage handles embedded not-found status, creates a private bucket and checks source integrity', async () => {
  let created = false,
    stored;
  const bytes = Buffer.from('Synthetic source');
  const cloud = cloudServices(
    { storageBackend: 'supabase', maxUpload: 1000 },
    {
      env,
      fetcher: async (url, opts) => {
        assert.equal(new URL(url).hostname, 'example.supabase.co');
        assert.equal(opts.redirect, 'error');
        if (String(url).includes('/bucket/'))
          return created
            ? Response.json({ public: false })
            : Response.json({ statusCode: '404' }, { status: 400 });
        if (String(url).endsWith('/bucket')) {
          assert.equal(JSON.parse(opts.body).public, false);
          created = true;
          return Response.json({});
        }
        if (opts.method === 'POST') {
          stored = opts.body;
          return Response.json({});
        }
        return new Response(stored);
      },
    },
  );
  const report = {
    company_id: 'org_fixture',
    stored_name: 'source.txt',
    mime: 'text/plain',
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
  await cloud.saveOriginal(report, bytes);
  assert.deepEqual(await cloud.download(report), bytes);
  await assert.rejects(
    cloud.saveOriginal({ ...report, stored_name: '../escape.txt' }, bytes),
    /Invalid/,
  );
  stored = Buffer.from('changed');
  await assert.rejects(cloud.download(report), /checksum/);
});
test('cloud authentication rejects an identity mismatch and does not bypass MFA', async () => {
  const config = { authBackend: 'supabase' };
  const user = { email: 'fixture@example.com', auth_user_id: 'expected', is_example: 0 };
  let identity = { id: 'other', email: user.email };
  const cloud = cloudServices(config, {
    env,
    fetcher: async () => Response.json({ user: identity, access_token: 'fixture-token' }),
  });
  await assert.rejects(cloud.authenticate(user, 'fixture-password'), /does not match/);
  identity = { id: 'expected', email: user.email, factors: [{ status: 'verified' }] };
  await assert.rejects(cloud.authenticate(user, 'fixture-password'), /MFA/);
});
test('invalid Supabase destinations are refused before credentials can be transmitted', () => {
  assert.throws(
    () =>
      cloudServices(
        { authBackend: 'supabase' },
        {
          env: { ...env, SUPABASE_URL: 'https://example.supabase.co.evil.com' },
          fetcher: () => {
            throw Error('must not send');
          },
        },
      ),
    /required/,
  );
});

test('parallel cloud identity checks share one request and retain a short verified cache', async () => {
  let calls = 0;
  const cloud = cloudServices(
    { authBackend: 'supabase' },
    {
      env,
      fetcher: async () => {
        calls++;
        await Promise.resolve();
        return Response.json({ id: 'fixture-id' });
      },
    },
  );
  const user = { auth_user_id: 'fixture-id', is_example: 0 };
  await Promise.all([
    cloud.checkIdentity(user),
    cloud.checkIdentity(user),
    cloud.checkIdentity(user),
  ]);
  await cloud.checkIdentity(user);
  assert.equal(calls, 1);
});
