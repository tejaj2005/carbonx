import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../server/app.mjs';
import { uuid } from '../server/db.mjs';
test('profile updates cannot grant roles, and government facility context stays in scope', async () => {
  const root = path.resolve('.local'),
    dir = fs.mkdtempSync(path.join(root, 'test-profile-'));
  const sys = await createApp({
    dataDir: dir,
    testing: true,
    aiEnabled: false,
    maxUpload: 10000,
    allowRegistration: true,
    allowDemo: false,
    monitoringEnabled: false,
  });
  try {
    const a = request.agent(sys.app),
      b = request.agent(sys.app);
    async function register(client) {
      const r = await client.post('/api/auth/register').send({
        company: 'Fixture Company',
        name: 'Fixture Owner',
        email: uuid() + '@example.com',
        password: 'Fixture-only-password-1234',
      });
      assert.equal(r.status, 201);
      return r.body;
    }
    const x = await register(a),
      y = await register(b);
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => a.get('/api/dashboard')));
    assert(concurrent.every((r) => r.status === 200));
    const changed = await a
      .patch('/api/auth/profile')
      .set('X-CSRF-Token', x.csrf)
      .send({ name: 'Updated Owner' });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.name, 'Updated Owner');
    assert.equal(changed.body.user.role, 'owner');
    assert.equal(
      (
        await a
          .patch('/api/auth/profile')
          .set('X-CSRF-Token', x.csrf)
          .send({ name: 'Injected', role: 'government_admin' })
      ).status,
      400,
    );
    async function facility(client, csrf) {
      const r = await client.post('/api/facilities').set('X-CSRF-Token', csrf).send({
        name: 'Fixture Works',
        latitude: 17.3,
        longitude: 78.4,
        boundary: 'Fixture boundary',
      });
      assert.equal(r.status, 201);
      return r.body.id;
    }
    const fa = await facility(a, x.csrf),
      fb = await facility(b, y.csrf);
    await sys.store.insert('government_admins', {
      user_id: x.user.id,
      authority: 'Test Oversight',
      demo_company_id: x.user.companyId,
    });
    assert.equal((await a.get('/api/government/facilities/' + fa + '/context')).status, 200);
    assert.equal((await a.get('/api/government/facilities/' + fb + '/context')).status, 404);
    assert.equal((await b.get('/api/government/facilities/' + fa + '/context')).status, 403);
    assert.equal(
      (await request(sys.app).get('/api/government/facilities/' + fa + '/context')).status,
      401,
    );
    assert.equal(
      (
        await a
          .patch('/api/auth/profile')
          .set('X-CSRF-Token', x.csrf)
          .send({ name: 'Updated Officer' })
      ).status,
      200,
    );
  } finally {
    await sys.store.close();
    assert(dir.startsWith(root + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
