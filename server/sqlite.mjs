import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const uuid = (prefix = '') => prefix + crypto.randomUUID();
export const now = () => new Date().toISOString();
export function openDatabase(dataDir, { recoverJobs = true } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'carbonx.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(
    'CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,is_example INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);' +
      "CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('owner','reviewer','analyst')),created_at TEXT NOT NULL);" +
      'CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS facilities(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),name TEXT NOT NULL,latitude REAL NOT NULL,longitude REAL NOT NULL,boundary TEXT NOT NULL,created_at TEXT NOT NULL);' +
      "CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES companies(id),facility_id TEXT REFERENCES facilities(id),name TEXT NOT NULL,year INTEGER NOT NULL,boundary TEXT NOT NULL,original_name TEXT NOT NULL,stored_name TEXT NOT NULL,sha256 TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,status TEXT NOT NULL,mode TEXT NOT NULL,page_count INTEGER NOT NULL DEFAULT 0,chunk_count INTEGER NOT NULL DEFAULT 0,warning TEXT NOT NULL DEFAULT '',archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);" +
      "CREATE TABLE IF NOT EXISTS pages(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,number INTEGER NOT NULL,text TEXT NOT NULL,tables_json TEXT NOT NULL DEFAULT '[]',ocr INTEGER NOT NULL DEFAULT 0,UNIQUE(report_id,number));" +
      'CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,number INTEGER NOT NULL,text TEXT NOT NULL,embedding TEXT,embedding_model TEXT);' +
      "CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,text TEXT NOT NULL,metric TEXT,value REAL,unit TEXT,normalized_value REAL,normalized_unit TEXT,year INTEGER,baseline_year INTEGER,boundary TEXT,facility_id TEXT REFERENCES facilities(id),claimed_change REAL,direction TEXT,sdgs_json TEXT NOT NULL,rationale TEXT NOT NULL,method TEXT NOT NULL,status TEXT NOT NULL,reason_json TEXT NOT NULL DEFAULT '[]',comparison_json TEXT NOT NULL DEFAULT '{}',review_state TEXT NOT NULL DEFAULT 'unreviewed',created_at TEXT NOT NULL);" +
      'CREATE TABLE IF NOT EXISTS observations(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,facility_id TEXT REFERENCES facilities(id),metric TEXT NOT NULL,value REAL NOT NULL,unit TEXT NOT NULL,normalized_value REAL NOT NULL,normalized_unit TEXT NOT NULL,year INTEGER NOT NULL,boundary TEXT NOT NULL,source TEXT NOT NULL,report_id TEXT REFERENCES reports(id),created_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),decision TEXT NOT NULL,rationale TEXT NOT NULL,created_at TEXT NOT NULL);' +
      "CREATE TABLE IF NOT EXISTS recommendations(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,title TEXT NOT NULL,action TEXT NOT NULL,priority TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL);" +
      'CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,report_id TEXT REFERENCES reports(id) ON DELETE CASCADE,type TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,stage TEXT NOT NULL,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS environment(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,facility_id TEXT NOT NULL REFERENCES facilities(id),kind TEXT NOT NULL,status TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,user_id TEXT,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT,metadata_json TEXT NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS evaluation_cases(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,expected_status TEXT NOT NULL,expected_sdgs TEXT NOT NULL,relevant_chunks TEXT NOT NULL,split TEXT NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS evaluation_runs(id TEXT PRIMARY KEY,company_id TEXT NOT NULL,metrics_json TEXT NOT NULL,created_at TEXT NOT NULL);' +
      'CREATE INDEX IF NOT EXISTS claim_company ON claims(company_id,report_id);' +
      'CREATE INDEX IF NOT EXISTS chunk_company ON chunks(company_id,report_id);' +
      'CREATE INDEX IF NOT EXISTS observation_scope ON observations(company_id,metric,year,boundary);' +
      'CREATE INDEX IF NOT EXISTS audit_company ON audit(company_id,created_at);' +
      'PRAGMA user_version=1;',
  );
  const q = (sql, ...params) => db.prepare(sql).all(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const x = fn();
      db.exec('COMMIT');
      return x;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  function audit(company, user, action, entity, entityId, metadata = {}) {
    run(
      'INSERT INTO audit VALUES(?,?,?,?,?,?,?,?)',
      uuid('evt_'),
      company,
      user,
      action,
      entity,
      entityId,
      JSON.stringify(metadata),
      now(),
    );
  }
  if (recoverJobs) {
    run(
      'UPDATE jobs SET status=?,stage=?,error=?,updated_at=? WHERE status IN (?,?)',
      'interrupted',
      'Restart required',
      'Processing was interrupted. Reprocess this report.',
      now(),
      'running',
      'queued',
    );
    run(
      'UPDATE reports SET status=?,warning=? WHERE status=?',
      'interrupted',
      'Processing was interrupted. Reprocess this report.',
      'processing',
    );
  }
  function insert(table, values) {
    if (
      !/^[a-z_][a-z0-9_]*$/.test(table) ||
      Object.keys(values).some((k) => !/^[a-z_][a-z0-9_]*$/.test(k))
    )
      throw new Error('Invalid database identifier');
    const keys = Object.keys(values);
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
  }
  const recColumns = q('PRAGMA table_info(recommendations)');
  if (!recColumns.some((c) => c.name === 'method'))
    db.exec("ALTER TABLE recommendations ADD COLUMN method TEXT NOT NULL DEFAULT 'rules'");
  return { db, q, get, run, insert, transaction, audit, close: () => db.close() };
}
