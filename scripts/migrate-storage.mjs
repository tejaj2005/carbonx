import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../server/config.mjs';
import { openDatabase } from '../server/db.mjs';
import { cloudServices } from '../server/cloud-services.mjs';
const store = await openDatabase(config.dataDir, { backend: 'sqlite', recoverJobs: false }),
  cloud = cloudServices({ ...config, storageBackend: 'supabase', testing: false });
let checked = 0;
try {
  await cloud.ensureBucket();
  const reports = await store.q('SELECT * FROM reports ORDER BY created_at');
  const seen = new Set();
  for (const r of reports) {
    const key = r.company_id + '/' + r.stored_name;
    if (seen.has(key)) continue;
    seen.add(key);
    const bytes = fs.readFileSync(path.join(config.dataDir, 'uploads', r.stored_name));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== r.sha256)
      throw Error('A local evidence checksum does not match; migration stopped.');
    await cloud.saveOriginal(r, bytes);
    if (!(await cloud.download(r)).equals(bytes))
      throw Error('Cloud evidence verification failed.');
    checked++;
  }
  console.log({ privateFilesVerified: checked, localOriginalsPreserved: true, storageReady: true });
} finally {
  await store.close();
}
