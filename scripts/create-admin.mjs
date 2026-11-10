import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { z } from 'zod';
import { openDatabase, uuid, now } from '../server/db.mjs';
import { hashPassword } from '../server/auth.mjs';
import { migrateGovernance } from '../server/governance.mjs';
import { config } from '../server/config.mjs';
let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({
  input: process.stdin,
  output,
  terminal: Boolean(process.stdin.isTTY),
});
let store;
try {
  console.log(
    'Create a Government Oversight administrator. No password is written to source or command arguments.',
  );
  const name = (await rl.question('Full name: ')).trim(),
    email = (await rl.question('Email: ')).trim().toLowerCase();
  process.stdout.write('Password (at least 12 characters, hidden): ');
  hidden = true;
  const password = await rl.question('');
  hidden = false;
  process.stdout.write('\n');
  z.object({
    name: z.string().min(2).max(80),
    email: z.email(),
    password: z.string().min(12).max(128),
  }).parse({ name, email, password });
  store = openDatabase(config.dataDir, { recoverJobs: false });
  migrateGovernance(store);
  if (store.get('SELECT id FROM users WHERE email=?', email))
    throw Error('This email already has an account. Use a new administrator email.');
  const companyId = uuid('authority_'),
    userId = uuid('usr_'),
    password_hash = await hashPassword(password);
  store.transaction(() => {
    store.insert('companies', {
      id: companyId,
      name: 'Government Oversight',
      is_example: 0,
      created_at: now(),
    });
    store.insert('users', {
      id: userId,
      company_id: companyId,
      name,
      email,
      password_hash,
      role: 'owner',
      disabled: 0,
      created_at: now(),
    });
    store.insert('government_admins', {
      user_id: userId,
      authority: 'Government Oversight',
      demo_company_id: null,
    });
    store.audit(companyId, userId, 'government.admin_provisioned', 'user', userId);
  });
  console.log('Administrator created. Use Government login in CarbonX.');
} catch (e) {
  console.error(
    e instanceof z.ZodError
      ? 'Check the administrator name, email and password length.'
      : e.message,
  );
  process.exitCode = 1;
} finally {
  hidden = false;
  rl.close();
  store?.close();
}
