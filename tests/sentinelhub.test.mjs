import test from 'node:test';
import assert from 'node:assert/strict';
import { sentinelHubTools, satelliteProvider } from '../server/sentinelhub.mjs';
const facility = { latitude: 17.385, longitude: 78.4867 };
const dates = {
  beforeStart: '2024-01-01',
  beforeEnd: '2024-01-31',
  afterStart: '2025-01-01',
  afterEnd: '2025-01-31',
};
const env = { COPERNICUS_CLIENT_ID: 'fixture-client', COPERNICUS_CLIENT_SECRET: 'fixture-secret' };
function setup({ valid = 9000, badStatus = 0 } = {}) {
  const requests = [];
  let time = Date.parse('2026-01-01');
  const tools = sentinelHubTools({
    env,
    clock: () => time,
    fetcher: async (url, options) => {
      requests.push({ url, body: options.body, headers: options.headers });
      if (badStatus)
        return new Response(JSON.stringify({ error: 'fixture-secret internal detail' }), {
          status: badStatus,
        });
      if (url.includes('/token'))
        return Response.json({ access_token: 'fixture-token', expires_in: 120 });
      const b = JSON.parse(options.body);
      if (url.includes('/search'))
        return Response.json({
          features: [
            {
              id: 'S2-' + b.datetime.slice(0, 10),
              properties: { datetime: b.datetime.slice(0, 10) + 'T10:30:00Z', 'eo:cloud_cover': 5 },
            },
          ],
        });
      const stats = { mean: 0.4, sampleCount: 10000, noDataCount: 10000 - valid };
      return Response.json({
        status: 'OK',
        data: [
          {
            interval: { from: b.aggregation.timeRange.from },
            outputs: {
              indices: { bands: { B0: { stats }, B1: { stats: { ...stats, mean: -0.1 } } } },
            },
          },
        ],
      });
    },
  });
  return {
    requests,
    tools,
    advance: (n) => {
      time += n;
    },
  };
}
test('Satellite selection is explicit; missing keys never trigger a silent fallback', async () => {
  assert.equal(satelliteProvider({}), 'earth-search');
  assert.equal(satelliteProvider({ SATELLITE_PROVIDER: 'sentinelhub' }), 'sentinelhub');
  assert.throws(() => satelliteProvider({ SATELLITE_PROVIDER: 'unknown' }), /SATELLITE_PROVIDER/);
  await assert.rejects(
    sentinelHubTools({
      env: {},
      fetcher: () => {
        throw Error('must not run');
      },
    }).compare(facility, dates),
    /COPERNICUS_CLIENT_ID/,
  );
});
test('OAuth token is shared for concurrent refreshes and refreshed before expiry', async () => {
  const x = setup();
  await Promise.all([x.tools.accessToken(), x.tools.accessToken()]);
  assert.equal(x.requests.length, 1);
  await x.tools.accessToken();
  assert.equal(x.requests.length, 1);
  x.advance(61000);
  await x.tools.accessToken();
  assert.equal(x.requests.length, 2);
  assert.match(x.requests[0].body, /grant_type=client_credentials/);
});
test('Catalog uses supplied coordinates, statistics use projected site bounds and cloud mask', async () => {
  const { tools, requests } = setup(),
    result = await tools.compare(facility, dates);
  assert.equal(result.provider.includes('Copernicus'), true);
  assert.equal(result.before.validFraction, 0.9);
  assert.equal(result.before.catalogueSceneId, 'S2-2024-01-01');
  assert.match(result.before.itemId, /day-mosaic/);
  const searches = requests.filter((x) => x.url.includes('/search'));
  assert.deepEqual(JSON.parse(searches[0].body).intersects.coordinates, [78.4867, 17.385]);
  const stats = JSON.parse(requests.find((x) => x.url.includes('/statistics/')).body);
  assert.equal(stats.aggregation.resx, 10);
  assert.equal(stats.input.bounds.properties.crs.endsWith('/32644'), true);
  assert.match(stats.aggregation.evalscript, /\[4,5,6\]/);
  assert.equal(requests.filter((x) => x.url.includes('/token')).length, 1);
  assert.ok(
    requests
      .filter((x) => !x.url.includes('/token'))
      .every((x) => x.headers.Authorization === 'Bearer fixture-token'),
  );
});
test('Cloud-masked low-coverage statistics abstain', async () => {
  await assert.rejects(setup({ valid: 100 }).tools.compare(facility, dates), /Too few clear/);
});
test('Satellite errors redact credentials and provider response details', async () => {
  await assert.rejects(
    setup({ badStatus: 401 }).tools.compare(facility, dates),
    (e) =>
      /401/.test(e.message) &&
      !e.message.includes('fixture-secret') &&
      !e.message.includes('internal detail'),
  );
});
