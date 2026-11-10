import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase as openSqlite, uuid, now } from './sqlite.mjs';
import { openPostgres } from './pg-store.mjs';
export { uuid, now };
export async function openDatabase(
  dataDir,
  { backend = process.env.DB_BACKEND || 'sqlite', recoverJobs = true, schema = 'carbonx' } = {},
) {
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  if (backend === 'postgres') {
    const migration = fs.readFileSync(
      new URL('../migrations/001_carbonx.sql', import.meta.url),
      'utf8',
    );
    const store = await openPostgres(process.env, migration, { schema });
    if (recoverJobs) {
      await store.run(
        "UPDATE jobs SET status='interrupted',stage='Restart required',error='Reprocess this report.' WHERE status IN ('running','queued')",
      );
      await store.run(
        "UPDATE reports SET status='interrupted',warning='Reprocess this report.' WHERE status='processing'",
      );
    }
    return store;
  }
  if (backend !== 'sqlite') throw Error('DB_BACKEND must be sqlite or postgres.');
  const raw = openSqlite(dataDir, { recoverJobs });
  if (!raw.q('PRAGMA table_info(users)').some((c) => c.name === 'auth_user_id'))
    raw.db.exec('ALTER TABLE users ADD COLUMN auth_user_id TEXT');
  const context = new AsyncLocalStorage();
  let tail = Promise.resolve();
  const lock = async (fn) => {
    const before = tail;
    let release;
    tail = new Promise((r) => (release = r));
    await before;
    try {
      return await fn();
    } finally {
      release();
    }
  };
  const invoke = (fn) => (context.getStore() ? Promise.resolve(fn()) : lock(fn));
  const store = { backend: 'sqlite', db: { exec: (sql) => invoke(() => raw.db.exec(sql)) } };
  for (const method of ['q', 'get', 'run', 'insert', 'audit', 'close'])
    store[method] = (...args) => invoke(() => raw[method](...args));
  store.transaction = (fn) =>
    context.getStore()
      ? fn()
      : lock(async () => {
          raw.db.exec('BEGIN IMMEDIATE');
          try {
            const result = await context.run(true, fn);
            raw.db.exec('COMMIT');
            return result;
          } catch (e) {
            raw.db.exec('ROLLBACK');
            throw e;
          }
        });
  return store;
}
