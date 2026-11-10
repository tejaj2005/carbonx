import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { publicSatelliteRoutes } from '../server/public-satellite.mjs';
test('public satellite context requires no login and never accepts a private company location', async () => {
  const app = express();
  publicSatelliteRoutes(
    app,
    {
      metadata: async () => ({
        provider: 'Fixture Meteosat',
        imageUrl: '/api/environment/satellite/live/image?t=fixture',
      }),
      frameAt: (t) => {
        assert.equal(t, 'fixture');
        return { bytes: Buffer.from('fixture-image') };
      },
    },
    { position: async () => ({ latitude: 10, longitude: 20, observedAt: '2026-11-10T00:00:00Z' }) },
    { testing: true },
  );
  const r = await request(app).get('/api/public/satellite/live?companyId=org_private&latitude=12');
  assert.equal(r.status, 200);
  assert.equal(r.body.imageUrl, '/api/public/satellite/image?t=fixture');
  assert(!JSON.stringify(r.body).includes('org_private'));
  assert.equal((await request(app).get('/api/public/satellite/position')).status, 200);
  assert.equal((await request(app).get(r.body.imageUrl)).status, 200);
});
