import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSatelliteTime, satelliteTools } from '../server/live-satellite.mjs';
const xml =
  '<Layer><Name>msg_iodc:ir108</Name><Dimension name="time" default="2026-11-10T14:30:00Z">range</Dimension></Layer>';
const png = Buffer.from('89504e470d0a1a0a', 'hex');
test('satellite keeps the provider timestamp, caches requests, and marks stale fallback', async () => {
  let calls = 0,
    now = Date.parse('2026-11-10T14:45:00Z'),
    fail = false;
  const service = satelliteTools({
    clock: () => now,
    fetcher: async (url) => {
      calls++;
      assert(url.startsWith('https://view.eumetsat.int/geoserver/wms?'));
      if (fail) throw Error('offline');
      return url.includes('GetCapabilities')
        ? new Response(xml)
        : new Response(png, { headers: { 'content-type': 'image/png' } });
    },
  });
  const first = await service.metadata();
  assert.equal(first.observedAt, '2026-11-10T14:30:00.000Z');
  assert.equal(first.ageMinutes, 15);
  assert.equal(first.intervalMinutes, 15);
  assert.equal(service.frameAt(first.observedAt).bytes.toString('hex'), png.toString('hex'));
  assert.throws(() => service.frameAt('incorrect-time'), /expired/);
  await service.metadata();
  assert.equal(calls, 2);
  now += 16 * 60000;
  fail = true;
  assert.equal((await service.metadata()).status, 'stale');
});
test('satellite rejects missing capture times and provider errors without inventing an image', async () => {
  assert.throws(() => parseSatelliteTime('<Layer/>'));
  const service = satelliteTools({
    fetcher: async () => new Response('unavailable', { status: 503 }),
  });
  await assert.rejects(service.latest(), /unavailable/);
});
