import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../server/config.mjs';
import { openDatabase } from '../server/db.mjs';
const filename = path.join(config.dataDir, 'carbonx.sqlite');
if (!fs.existsSync(filename)) throw Error('Existing SQLite database not found.');
const source = new DatabaseSync(filename, { readOnly: true }),
  target = await openDatabase(config.dataDir, { backend: 'postgres', recoverJobs: false });
try {
  const running = await fetch('http://127.0.0.1:' + config.port + '/api/health', {
    signal: AbortSignal.timeout(1000),
  })
    .then((r) => r.ok)
    .catch(() => false);
  if (running) throw Error('Stop the CarbonX server before the database import.');
  source.exec('BEGIN');
  const active = source
    .prepare("SELECT count(*) AS n FROM jobs WHERE status IN ('running','queued')")
    .get().n;
  if (active)
    throw Error(
      'Wait for active report jobs to finish, then stop the CarbonX server before importing.',
    );
  const existing = await target.get('SELECT count(*) AS n FROM companies');
  if (existing.n) throw Error('Target CarbonX schema is not empty. Import was not applied.');
  const tables = source
    .prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((x) => x.name);
  const ordered = [],
    pending = new Set(tables);
  while (pending.size) {
    let moved = false;
    for (const table of [...pending]) {
      if (!/^[a-z_]+$/.test(table)) throw Error('Invalid source table');
      const dependencies = source
        .prepare('PRAGMA foreign_key_list(' + table + ')')
        .all()
        .map((x) => x.table);
      if (dependencies.every((x) => !pending.has(x))) {
        ordered.push(table);
        pending.delete(table);
        moved = true;
      }
    }
    if (!moved) throw Error('Cyclic source dependencies need reconciliation.');
  }
  const rows = Object.fromEntries(
    ordered.map((table) => [table, source.prepare('SELECT * FROM ' + table).all()]),
  );
  const checksum = crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const backupDir = path.join(config.dataDir, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, 'before-postgres-' + Date.now() + '.json');
  fs.writeFileSync(backup, JSON.stringify(rows)); // Private ignored backup; includes credential hashes/session digests.
  await target.transaction(async () => {
    for (const table of ordered) {
      for (const row of rows[table]) await target.insert(table, row);
      const count = await target.get('SELECT count(*) AS n FROM ' + table);
      if (count.n !== rows[table].length) throw Error('Imported row count mismatch.');
    }
    await target.audit('system', null, 'database.imported', 'migration', null, {
      checksum,
      counts: Object.fromEntries(ordered.map((t) => [t, rows[t].length])),
    });
  });
  console.log({
    imported: true,
    tables: ordered.length,
    rows: Object.values(rows).reduce((n, a) => n + a.length, 0),
    sourcePreserved: true,
    checksum,
  });
} finally {
  try {
    source.exec('ROLLBACK');
  } catch {}
  source.close();
  await target.close();
}
