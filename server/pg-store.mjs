import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
export function parameterizedSql(input) {
  if (/^PRAGMA table_info\(([a-z_]+)\)$/.test(input))
    return {
      text: 'SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position',
      parameters: [input.match(/\(([a-z_]+)\)/)[1]],
    };
  let text = '',
    index = 0,
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === "'") {
      if (quoted && input[i + 1] === "'") {
        text += "''";
        i++;
        continue;
      }
      quoted = !quoted;
    }
    text += c === '?' && !quoted ? '$' + ++index : c;
  }
  if (/^INSERT OR IGNORE /i.test(text))
    text = text.replace(/^INSERT OR IGNORE /i, 'INSERT ') + ' ON CONFLICT DO NOTHING';
  return { text };
}
export async function openPostgres(env, migration, { schema = 'carbonx', Pool = pg.Pool } = {}) {
  if (!/^carbonx(?:_test_[a-f0-9]+)?$/.test(schema)) throw Error('Invalid CarbonX schema.');
  const uri = new URL(env.SUPABASE_DB_URL),
    project = new URL(env.SUPABASE_URL).hostname.split('.')[0];
  if (
    uri.protocol !== 'postgresql:' ||
    !(
      uri.hostname === 'db.' + project + '.supabase.co' ||
      (uri.hostname.endsWith('.pooler.supabase.com') &&
        decodeURIComponent(uri.username) === 'postgres.' + project)
    )
  )
    throw Error('Database URL does not match the Supabase project.');
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) uri.searchParams.delete(k);
  pg.types.setTypeParser(20, (v) => {
    const n = Number(v);
    if (!Number.isSafeInteger(n)) throw Error('Database count exceeds safe numeric range.');
    return n;
  });
  const pool = new Pool({
    connectionString: uri.toString(),
    ssl: { rejectUnauthorized: true },
    sslnegotiation: env.SUPABASE_SSL_NEGOTIATION || 'postgres',
    max: 5,
    connectionTimeoutMillis: 15000,
    query_timeout: 30000,
    options: '-c search_path=' + schema + ',pg_catalog',
    application_name: 'carbonx',
  });
  const context = new AsyncLocalStorage();
  const query = async (input, params = []) => {
    const sql = parameterizedSql(input);
    return (context.getStore() || pool).query(sql.text, sql.parameters || params);
  };
  let client;
  try {
    client = await pool.connect();
  } catch (e) {
    await pool.end();
    throw e;
  }
  let migrationError;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'carbonx:migrations:' + schema,
    ]);
    await client.query('CREATE SCHEMA IF NOT EXISTS "' + schema + '"');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "' +
        schema +
        '".schema_migrations(version INTEGER PRIMARY KEY,checksum TEXT NOT NULL,applied_at TEXT NOT NULL)',
    );
    const checksum = crypto.createHash('sha256').update(migration).digest('hex');
    const previous = await client.query(
      'SELECT checksum FROM "' + schema + '".schema_migrations WHERE version=1',
    );
    if (previous.rows[0] && previous.rows[0].checksum !== checksum)
      throw Error('Migration checksum mismatch. Reconcile before starting.');
    if (!previous.rows.length) {
      await client.query(migration);
      await client.query('INSERT INTO "' + schema + '".schema_migrations VALUES(1,$1,$2)', [
        checksum,
        new Date().toISOString(),
      ]);
    }
    await client.query('REVOKE ALL ON SCHEMA "' + schema + '" FROM PUBLIC,anon,authenticated');
    const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [
      schema,
    ]);
    for (const { tablename } of tables.rows) {
      if (!/^[a-z_]+$/.test(tablename)) throw Error('Invalid table');
      await client.query(
        'ALTER TABLE "' + schema + '"."' + tablename + '" ENABLE ROW LEVEL SECURITY',
      );
      await client.query(
        'REVOKE ALL ON "' + schema + '"."' + tablename + '" FROM PUBLIC,anon,authenticated',
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    migrationError = e;
  } finally {
    client.release();
  }
  if (migrationError) {
    await pool.end();
    throw migrationError;
  }
  const run = async (sql, ...params) => {
    const r = await query(sql, params);
    return { changes: r.rowCount };
  };
  const q = async (sql, ...params) => (await query(sql, params)).rows;
  const get = async (sql, ...params) => (await q(sql, ...params))[0];
  const insert = async (table, values) => {
    const keys = Object.keys(values);
    if (!/^[a-z_]+$/.test(table) || keys.some((k) => !/^[a-z_][a-z0-9_]*$/.test(k)))
      throw Error('Invalid database identifier');
    return run(
      'INSERT INTO ' +
        table +
        ' (' +
        keys.join(',') +
        ') VALUES (' +
        keys.map(() => '?').join(',') +
        ')',
      ...keys.map((k) => values[k] ?? null),
    );
  };
  const transaction = async (fn) => {
    if (context.getStore()) return fn();
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const result = await context.run(c, fn);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  };
  const audit = (company, user, action, entity, id, metadata = {}) =>
    run(
      'INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)',
      'evt_' + crypto.randomUUID(),
      company,
      user,
      action,
      entity,
      id,
      JSON.stringify(metadata),
      new Date().toISOString(),
    );
  return {
    backend: 'postgres',
    schema,
    q,
    get,
    run,
    insert,
    transaction,
    audit,
    db: { exec: (sql) => query(sql.replace(/\bREAL\b/g, 'DOUBLE PRECISION')) },
    close: () => pool.end(),
  };
}
