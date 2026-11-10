import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
export async function fetchJson(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(25000), redirect: 'error' });
  if (!r.ok)
    throw new Error(
      'Provider returned HTTP ' +
        r.status +
        (r.status === 429 ? '; rate limit reached. Retry later.' : '.'),
    );
  return r.json();
}
export async function atmosphericContext(facility, fetcher = fetchJson) {
  const location =
    'latitude=' +
    encodeURIComponent(facility.latitude) +
    '&longitude=' +
    encodeURIComponent(facility.longitude);
  const sources = [
    [
      'weather',
      'https://api.open-meteo.com/v1/forecast?' +
        location +
        '&current=temperature_2m,relative_humidity_2m,wind_speed_10m&past_days=2&forecast_days=1&hourly=temperature_2m',
    ],
    [
      'air_quality',
      'https://air-quality-api.open-meteo.com/v1/air-quality?' +
        location +
        '&current=pm2_5,pm10,nitrogen_dioxide,carbon_monoxide&past_days=2&forecast_days=1&hourly=pm2_5',
    ],
  ];
  const results = await Promise.all(
    sources.map(async ([kind, url]) => {
      try {
        return { kind, status: 'available', data: await fetcher(url), source: url.split('?')[0] };
      } catch (e) {
        return { kind, status: 'unavailable', error: e.message, source: url.split('?')[0] };
      }
    }),
  );
  return {
    status: results.every((r) => r.status === 'available')
      ? 'available'
      : results.some((r) => r.status === 'available')
        ? 'partial'
        : 'unavailable',
    observedAt: new Date().toISOString(),
    sources: results,
    interpretation:
      'Regional atmospheric context. These values are not facility emissions, measured energy use or verification of a carbon credit claim.',
  };
}
export function assetUrl(value) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    !['sentinel-cogs.s3.us-west-2.amazonaws.com', 'sentinel-s2-l2a.s3.amazonaws.com'].includes(
      u.hostname,
    ) ||
    u.username ||
    u.password
  )
    throw new Error('Imagery asset is not on an approved public provider.');
  return u.href;
}
export async function searchScene(facility, start, end, fetcher = fetchJson) {
  const data = await fetcher('https://earth-search.aws.element84.com/v1/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      intersects: { type: 'Point', coordinates: [facility.longitude, facility.latitude] },
      datetime: start + 'T00:00:00Z/' + end + 'T23:59:59Z',
      limit: 25,
      query: { 'eo:cloud_cover': { lte: 20 } },
    }),
  });
  const scenes = (data.features || [])
    .filter((x) => x.assets?.red && x.assets?.nir && x.assets?.green && x.assets?.scl)
    .sort((a, b) => (a.properties['eo:cloud_cover'] || 0) - (b.properties['eo:cloud_cover'] || 0));
  if (!scenes.length)
    throw new Error(
      'No suitable scene with the required bands and cloud cover at or below 20% was returned for this location and date window.',
    );
  return scenes[0];
}
async function readAsset(asset, bbox) {
  const signal = AbortSignal.timeout(45000);
  const tiff = await fromUrl(
    assetUrl(asset.href),
    { allowFullFile: false, blockSize: 65536, cacheSize: 24 },
    signal,
  );
  const image = await tiff.getImage();
  const [ox, oy] = image.getOrigin(),
    [rx, ry] = image.getResolution();
  const xs = [(bbox[0] - ox) / rx, (bbox[2] - ox) / rx],
    ys = [(bbox[1] - oy) / ry, (bbox[3] - oy) / ry];
  const window = [
    Math.max(0, Math.floor(Math.min(...xs))),
    Math.max(0, Math.floor(Math.min(...ys))),
    Math.min(image.getWidth(), Math.ceil(Math.max(...xs))),
    Math.min(image.getHeight(), Math.ceil(Math.max(...ys))),
  ];
  if (window[2] <= window[0] || window[3] <= window[1])
    throw new Error('Selected site falls outside the imagery tile.');
  const data = await image.readRasters({
    window,
    width: 64,
    height: 64,
    resampleMethod: 'nearest',
    interleave: true,
    signal,
  });
  return data;
}
export function indices(red, nir, green, scl, scales) {
  let sumNDVI = 0,
    sumNDWI = 0,
    count = 0,
    water = 0;
  const n = Math.min(red.length, nir.length, green.length, scl.length);
  for (let i = 0; i < n; i++) {
    if (![4, 5, 6].includes(Number(scl[i]))) continue;
    const r = red[i] * scales.red.scale + scales.red.offset,
      ir = nir[i] * scales.nir.scale + scales.nir.offset,
      g = green[i] * scales.green.scale + scales.green.offset;
    if (
      ![r, ir, g].every(Number.isFinite) ||
      Math.min(r, ir, g) < 0 ||
      r + ir <= 1e-8 ||
      g + ir <= 1e-8
    )
      continue;
    const ndvi = (ir - r) / (ir + r),
      ndwi = (g - ir) / (g + ir);
    if (Math.abs(ndvi) > 1 || Math.abs(ndwi) > 1) continue;
    sumNDVI += ndvi;
    sumNDWI += ndwi;
    water += ndwi > 0 ? 1 : 0;
    count++;
  }
  if (count < Math.max(30, n * 0.2))
    throw new Error('Too few clear valid pixels remain after scene classification masking.');
  return {
    meanNDVI: sumNDVI / count,
    meanNDWI: sumNDWI / count,
    waterPositiveFraction: water / count,
    validPixels: count,
    totalSamplePixels: n,
    validFraction: count / n,
  };
}
export async function analyzeScene(scene, facility) {
  const epsg = Number(
    scene.properties['proj:epsg'] ||
      String(scene.properties['proj:code'] || '')
        .split(':')
        .pop(),
  );
  if (!((epsg >= 32601 && epsg <= 32660) || (epsg >= 32701 && epsg <= 32760)))
    throw new Error('This scene uses an unsupported projection.');
  const zone = epsg % 100,
    south = epsg >= 32700;
  const center = proj4(
    'EPSG:4326',
    '+proj=utm +zone=' + zone + (south ? ' +south' : '') + ' +datum=WGS84 +units=m +no_defs',
    [facility.longitude, facility.latitude],
  );
  const bbox = [center[0] - 500, center[1] - 500, center[0] + 500, center[1] + 500];
  const [red, nir, green, scl] = await Promise.all(
    ['red', 'nir', 'green', 'scl'].map((k) => readAsset(scene.assets[k], bbox)),
  );
  const scales = Object.fromEntries(
    ['red', 'nir', 'green'].map((k) => {
      const b = scene.assets[k]['raster:bands']?.[0] || {};
      return [k, { scale: b.scale ?? 0.0001, offset: b.offset ?? 0 }];
    }),
  );
  return {
    itemId: scene.id,
    date: scene.properties.datetime,
    cloudCover: scene.properties['eo:cloud_cover'],
    thumbnail: scene.assets.thumbnail ? assetUrl(scene.assets.thumbnail.href) : null,
    source:
      'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/' +
      encodeURIComponent(scene.id),
    sampleWindowMeters: 1000,
    sampling: '64 by 64 nearest-neighbour samples in a 1 km square centred on the selected site',
    ...indices(red, nir, green, scl, scales),
  };
}
export async function satelliteComparison(facility, dates) {
  const beforeScene = await searchScene(facility, dates.beforeStart, dates.beforeEnd);
  const afterScene = await searchScene(facility, dates.afterStart, dates.afterEnd);
  if (beforeScene.id === afterScene.id)
    throw new Error('Both date windows returned the same scene. Select distinct periods.');
  const before = await analyzeScene(beforeScene, facility),
    after = await analyzeScene(afterScene, facility);
  return {
    status: 'available',
    provider: 'Element 84 Earth Search / Sentinel-2 L2A',
    observedAt: new Date().toISOString(),
    before,
    after,
    deltaNDVI: after.meanNDVI - before.meanNDVI,
    deltaNDWI: after.meanNDWI - before.meanNDWI,
    interpretation:
      'Exploratory vegetation and water-index context. Cloud masking, seasonality, sample size and site boundaries affect interpretation. This comparison does not prove a sustainability claim or establish facility emissions.',
  };
}
