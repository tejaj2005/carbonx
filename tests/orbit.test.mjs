import test from 'node:test';
import assert from 'node:assert/strict';
import { orbitTools } from '../server/orbit.mjs';
test('orbital coordinates retain real source times, share cached requests, and fail to last-known status', async () => {
  let calls = 0,
    now = 1794324509000,
    fail = false;
  const tracker = orbitTools({
    clock: () => now,
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.wheretheiss.at/v1/satellites/25544');
      assert.equal(options.redirect, 'error');
      if (fail) throw Error('offline');
      return new Response(
        JSON.stringify({
          id: 25544,
          latitude: 50.2,
          longitude: 122.2,
          altitude: 410,
          timestamp: now / 1000,
          units: 'kilometers',
        }),
      );
    },
  });
  const [a, b] = await Promise.all([tracker.position(), tracker.position()]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.equal(a.observedAt, new Date(now).toISOString());
  now += 16000;
  fail = true;
  const fallback = await tracker.position();
  assert.equal(fallback.status, 'stale');
  assert.equal(fallback.latitude, 50.2);
  assert.equal(fallback.ageSeconds, 16);
});
test('orbital tracking rejects invalid coordinates and never invents a position', async () => {
  const tracker = orbitTools({
    fetcher: async () =>
      new Response(
        JSON.stringify({
          id: 25544,
          latitude: 999,
          longitude: 0,
          altitude: 410,
          timestamp: 1,
          units: 'kilometers',
        }),
      ),
  });
  await assert.rejects(tracker.position(), /unavailable/);
});
