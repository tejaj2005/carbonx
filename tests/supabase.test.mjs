import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSupabase, checkSupabaseApi } from '../server/supabase.mjs';
test('Supabase check is read only, enforces TLS and never returns connection secrets', async () => {
  let options,
    queries = [];
  class Client {
    constructor(x) {
      options = x;
    }
    async connect() {}
    async query(q) {
      queries.push(q);
      return { rows: [{ tls: true, tables: 0 }] };
    }
    async end() {}
  }
  const result = await checkSupabase(
    {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_DB_URL:
        'postgresql://postgres.example:private@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=no-verify',
    },
    Client,
  );
  assert.equal(result.status, 'connected');
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert(!options.connectionString.includes('sslmode'));
  assert.equal(queries[0], 'BEGIN READ ONLY');
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert(!JSON.stringify(result).includes('private'));
});
test('Supabase refuses destinations outside the configured project', async () => {
  assert.equal(
    (
      await checkSupabase({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_DB_URL: 'postgresql://postgres:secret@evil.example/db',
      })
    ).status,
    'invalid_configuration',
  );
});

test('Supabase HTTPS checks restrict the destination and keep keys server-side', async () => {
  const calls = [];
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'fixture-server-key',
  };
  const result = await checkSupabaseApi(env, async (url, opts) => {
    calls.push({ url: String(url), opts });
    return new Response('{}');
  });
  assert.equal(result.status, 'connected');
  assert.equal(calls.length, 2);
  assert(calls.every((x) => x.url.startsWith(env.SUPABASE_URL + '/')));
  assert(
    calls.every(
      (x) => x.opts.headers.apikey === env.SUPABASE_SECRET_KEY && x.opts.redirect === 'error',
    ),
  );
  assert(!JSON.stringify(result).includes(env.SUPABASE_SECRET_KEY));
  assert.equal(
    (
      await checkSupabaseApi(
        { ...env, SUPABASE_URL: 'https://example.supabase.co.evil.com' },
        () => {
          throw Error('must not fetch');
        },
      )
    ).status,
    'invalid_configuration',
  );
});
