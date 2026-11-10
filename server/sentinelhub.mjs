import proj4 from 'proj4';
const TOKEN =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const CATALOG = 'https://sh.dataspace.copernicus.eu/catalog/v1/search';
const STATS = 'https://sh.dataspace.copernicus.eu/statistics/v1';
export const INDEX_SCRIPT = `//VERSION=3
function setup() {
  return {input:[{bands:["B03","B04","B08","SCL","dataMask"]}],
    output:[{id:"indices",bands:2,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};
}
function evaluatePixel(s) {
  const a=s.B08+s.B04, b=s.B03+s.B08;
  const valid=s.dataMask===1 && [4,5,6].includes(s.SCL) && a>0.00000001 && b>0.00000001
    && Math.min(s.B03,s.B04,s.B08)>=0;
  return {indices:valid?[(s.B08-s.B04)/a,(s.B03-s.B08)/b]:[0,0],dataMask:[valid?1:0]};
}`;
export function sentinelHubTools({ env = process.env, fetcher = fetch, clock = Date.now } = {}) {
  let token = null,
    expires = 0,
    pending = null;
  async function request(url, options) {
    let response;
    try {
      response = await fetcher(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw Error('Copernicus request could not complete. Check connectivity and retry.');
    }
    if (!response.ok) {
      if (response.status === 401) {
        token = null;
        expires = 0;
      }
      throw Error(
        'Copernicus returned HTTP ' +
          response.status +
          '. Check account access, credentials and quota.',
      );
    }
    try {
      return await response.json();
    } catch {
      throw Error('Copernicus returned an invalid response.');
    }
  }
  async function accessToken() {
    if (!env.COPERNICUS_CLIENT_ID?.trim() || !env.COPERNICUS_CLIENT_SECRET?.trim())
      throw Error('Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in the server .env file.');
    if (token && clock() < expires) return token;
    if (!pending)
      pending = (async () => {
        const result = await request(TOKEN, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: env.COPERNICUS_CLIENT_ID.trim(),
            client_secret: env.COPERNICUS_CLIENT_SECRET.trim(),
          }).toString(),
        });
        if (
          typeof result.access_token !== 'string' ||
          !result.access_token ||
          !Number.isFinite(result.expires_in) ||
          result.expires_in <= 0
        )
          throw Error('Copernicus did not return a usable access token.');
        token = result.access_token;
        expires = clock() + Math.max(0, result.expires_in - 60) * 1000;
        return token;
      })().finally(() => {
        pending = null;
      });
    return pending;
  }
  async function post(url, body) {
    return request(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + (await accessToken()),
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }
  async function sample(facility, start, end) {
    const lon = Number(facility.longitude),
      lat = Number(facility.latitude);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lat < -80 ||
      lat > 80 ||
      lon < -180 ||
      lon > 180
    )
      throw Error('Invalid site coordinates.');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) ||
      start > end
    )
      throw Error('Invalid scene date window.');
    const found = await post(CATALOG, {
      collections: ['sentinel-2-l2a'],
      intersects: { type: 'Point', coordinates: [lon, lat] },
      datetime: start + 'T00:00:00Z/' + end + 'T23:59:59Z',
      limit: 100,
    });
    const candidates = (found.features || [])
      .filter(
        (x) =>
          x.id &&
          x.properties?.datetime &&
          Number.isFinite(x.properties['eo:cloud_cover']) &&
          x.properties['eo:cloud_cover'] <= 20 &&
          x.properties.datetime.slice(0, 10) >= start &&
          x.properties.datetime.slice(0, 10) <= end,
      )
      .sort((a, b) => a.properties['eo:cloud_cover'] - b.properties['eo:cloud_cover']);
    if (!candidates.length)
      throw Error('No low-cloud Sentinel-2 scene was found for this site and date window.');
    const selected = candidates[0],
      day = selected.properties.datetime.slice(0, 10);
    const zone = Math.min(60, Math.floor((lon + 180) / 6) + 1),
      epsg = (lat >= 0 ? 32600 : 32700) + zone;
    const center = proj4(
      'EPSG:4326',
      '+proj=utm +zone=' + zone + (lat < 0 ? ' +south' : '') + ' +datum=WGS84 +units=m +no_defs',
      [lon, lat],
    );
    const next = new Date(Date.parse(day) + 86400000).toISOString();
    const result = await post(STATS, {
      input: {
        bounds: {
          bbox: [center[0] - 500, center[1] - 500, center[0] + 500, center[1] + 500],
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/' + epsg },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: { maxCloudCoverage: 20, mosaickingOrder: 'leastCC' },
          },
        ],
      },
      aggregation: {
        timeRange: { from: day + 'T00:00:00Z', to: next },
        aggregationInterval: { of: 'P1D' },
        resx: 10,
        resy: 10,
        evalscript: INDEX_SCRIPT,
      },
    });
    const row = result.data?.find((x) => x.interval?.from?.slice(0, 10) === day);
    const a = row?.outputs?.indices?.bands?.B0?.stats,
      b = row?.outputs?.indices?.bands?.B1?.stats;
    if (
      row?.error ||
      !a ||
      !b ||
      ![a.mean, b.mean, a.sampleCount, a.noDataCount, b.sampleCount, b.noDataCount].every(
        Number.isFinite,
      ) ||
      Math.abs(a.mean) > 1 ||
      Math.abs(b.mean) > 1 ||
      a.sampleCount <= 0 ||
      a.noDataCount < 0 ||
      a.noDataCount > a.sampleCount ||
      a.sampleCount !== b.sampleCount ||
      a.noDataCount !== b.noDataCount
    )
      throw Error('Satellite index statistics are unavailable for the selected day.');
    const valid = a.sampleCount - a.noDataCount;
    if (valid < 30 || valid / a.sampleCount < 0.2)
      throw Error('Too few clear valid pixels remain after scene classification masking.');
    return {
      itemId: 'day-mosaic-' + day,
      catalogueSceneId: selected.id,
      date: day + 'T00:00:00Z',
      cloudCover: selected.properties['eo:cloud_cover'],
      thumbnail: null,
      source: 'https://browser.dataspace.copernicus.eu/',
      sampleWindowMeters: 1000,
      sampling:
        '1 km site window · 10 m daily mosaic; catalogue scene identifies the selected day, not exclusive pixel provenance.',
      meanNDVI: a.mean,
      meanNDWI: b.mean,
      validPixels: valid,
      totalSamplePixels: a.sampleCount,
      validFraction: valid / a.sampleCount,
    };
  }
  async function compare(facility, dates) {
    const before = await sample(facility, dates.beforeStart, dates.beforeEnd),
      after = await sample(facility, dates.afterStart, dates.afterEnd);
    if (before.date === after.date)
      throw Error('Both date windows returned the same day. Select distinct periods.');
    return {
      status: 'available',
      provider: 'Copernicus Data Space / Sentinel Hub · Sentinel-2 L2A',
      observedAt: new Date(clock()).toISOString(),
      before,
      after,
      deltaNDVI: after.meanNDVI - before.meanNDVI,
      deltaNDWI: after.meanNDWI - before.meanNDWI,
      interpretation:
        'Dated daily-mosaic vegetation and water-index context around supplied coordinates. This cannot verify ownership, factory emissions, fraud or carbon credits. Seasonality, boundaries and cloud masking affect interpretation.',
    };
  }
  return { compare, accessToken };
}
const satellite = sentinelHubTools();
export function satelliteProvider(env = process.env) {
  const provider = (env.SATELLITE_PROVIDER || 'earth-search').trim().toLowerCase();
  if (!['earth-search', 'sentinelhub'].includes(provider))
    throw Error('SATELLITE_PROVIDER must be earth-search or sentinelhub.');
  return provider;
}
export const copernicusComparison = (facility, dates) => satellite.compare(facility, dates);
