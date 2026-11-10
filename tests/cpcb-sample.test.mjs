import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchCpcbStations, CPCB_SAMPLE_KEY, cpcbAccess, INDIA_METROS } from '../server/india.mjs';
test('official sample mode makes a bounded preview and preserves station coordinates and missing units', async () => {
  let count = 0;
  const result = await fetchCpcbStations(INDIA_METROS[0], CPCB_SAMPLE_KEY, async (url) => {
    count++;
    assert.equal(new URL(url).searchParams.get('limit'), '10');
    return {
      total: 30,
      records: Array.from({ length: 10 }, () => ({
        station: 'Fixture',
        city: 'Delhi',
        latitude: '28.6',
        longitude: '77.2',
        pollutant_avg: '50',
        pollutant_id: 'PM2.5',
        last_update: '10-11-2026 12:30:00',
      })),
    };
  });
  assert.equal(count, 1);
  assert.equal(result.complete, false);
  assert.equal(result.status, 'partial');
  assert.equal(result.accessMode, 'public_sample');
  assert.equal(result.records[0].latitude, 28.6);
  assert.equal(result.records[0].unit, null);
  assert.equal(cpcbAccess({}).mode, 'sample');
  assert.equal(cpcbAccess({ CPCB_ACCESS_MODE: 'disabled' }).key, null);
});
