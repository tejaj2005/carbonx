import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { openPostgres, parameterizedSql } from '../server/pg-store.mjs';
test('PostgreSQL migration, typed parameters, atomic rollback and private schema execute on a real local PostgreSQL engine', async () => {
  const db = new PGlite();
  await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;');
  let tail = Promise.resolve();
  class LocalPool {
    constructor(options) {
      assert.equal(options.ssl.rejectUnauthorized, true);
    }
    async connect() {
      const before = tail;
      let release;
      tail = new Promise((r) => (release = r));
      await before;
      let returned = false;
      return {
        query: async (sql, params) => {
          const result = params?.length ? await db.query(sql, params) : (await db.exec(sql)).at(-1);
          return { ...result, rowCount: result?.affectedRows || 0 };
        },
        release() {
          if (!returned) {
            returned = true;
            release();
          }
        },
      };
    }
    async query(sql, params) {
      const c = await this.connect();
      try {
        return await c.query(sql, params);
      } finally {
        c.release();
      }
    }
    async end() {}
  }
  // Local engine only: no Supabase connection or external test records.
  await db.exec('SET search_path=carbonx,pg_catalog;');
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_DB_URL:
      'postgresql://postgres.example:fixture@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres',
  };
  const migration = fs.readFileSync('migrations/001_carbonx.sql', 'utf8');
  const store = await openPostgres(env, migration, { Pool: LocalPool });
  await store.insert('companies', {
    id: 'org_first',
    name: 'First company',
    is_example: 1,
    created_at: new Date().toISOString(),
  });
  await assert.rejects(
    store.transaction(async () => {
      await store.insert('companies', {
        id: 'org_rollback',
        name: 'Rollback company',
        is_example: 1,
        created_at: new Date().toISOString(),
      });
      throw Error('rollback');
    }),
    /rollback/,
  );
  assert.equal(
    (await store.get("SELECT count(*) AS n FROM companies WHERE id='org_rollback'")).n,
    0,
  );
  assert.equal(
    (await store.q('PRAGMA table_info(users)')).some((c) => c.name === 'auth_user_id'),
    true,
  );
  await store.run(
    'INSERT OR IGNORE INTO company_registry(company_id,updated_at) VALUES(?,?)',
    'org_first',
    new Date().toISOString(),
  );
  const result = await store.run(
    'INSERT OR IGNORE INTO company_registry(company_id,updated_at) VALUES(?,?)',
    'org_first',
    new Date().toISOString(),
  );
  assert.equal(result.changes, 0);
  assert.equal(
    (await store.get('SELECT name FROM companies WHERE id=?', 'org_first')).name,
    'First company',
  );
  await db.exec('SET ROLE anon;');
  await assert.rejects(db.query('SELECT * FROM carbonx.companies'), /permission denied/);
  await db.exec('RESET ROLE;');
  await store.close();
  await db.close();
});
test('SQL placeholders never replace question marks inside quoted source text', () => {
  assert.equal(
    parameterizedSql("SELECT '?' AS example WHERE id=? AND text='it''s ?'").text,
    "SELECT '?' AS example WHERE id=$1 AND text='it''s ?'",
  );
});
