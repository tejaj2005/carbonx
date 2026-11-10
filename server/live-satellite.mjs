// Fixed public EUMETSAT endpoint. No keys, user URLs or facility coordinates leave CarbonX.
const endpoint = 'https://view.eumetsat.int/geoserver/wms';
export const LIVE_LAYER = 'msg_iodc:ir108';
const maxAge = 15 * 60 * 1000;
export function parseSatelliteTime(xml) {
  const name = '<Name>' + LIVE_LAYER + '</Name>',
    position = xml.indexOf(name);
  if (position < 0) throw Error('India satellite layer unavailable.');
  const start = xml.lastIndexOf('<Layer', position),
    end = xml.indexOf('</Layer>', position);
  const layer = xml.slice(start, end);
  const dimension = layer.match(/<Dimension\b(?=[^>]*\bname="time")[^>]*\bdefault="([^"]+)"/i);
  if (!dimension || !Number.isFinite(Date.parse(dimension[1])))
    throw Error('Satellite capture time unavailable.');
  return new Date(dimension[1]).toISOString();
}
export function satelliteTools({ fetcher = fetch, clock = Date.now } = {}) {
  let cache, pending;
  const frames = new Map();
  async function request(params) {
    const response = await fetcher(endpoint + '?' + new URLSearchParams(params), {
      signal: AbortSignal.timeout(25000),
      redirect: 'error',
    });
    if (!response.ok) throw Error('Satellite provider temporarily unavailable.');
    return response;
  }
  async function load() {
    const capabilities = await request({
      service: 'WMS',
      request: 'GetCapabilities',
      version: '1.3.0',
    });
    const observedAt = parseSatelliteTime(await capabilities.text());
    const response = await request({
      service: 'WMS',
      version: '1.1.1',
      request: 'GetMap',
      layers: LIVE_LAYER,
      styles: '',
      format: 'image/png',
      transparent: 'false',
      srs: 'EPSG:4326',
      bbox: '67,6,98,37',
      width: '640',
      height: '640',
      time: observedAt,
    });
    if (!(response.headers.get('content-type') || '').startsWith('image/png'))
      throw Error('Satellite image unavailable.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.length > 5_000_000 ||
      bytes.length < 8 ||
      bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    )
      throw Error('Invalid satellite image.');
    cache = { bytes, observedAt, retrievedAt: new Date(clock()).toISOString(), fetched: clock() };
    frames.set(observedAt, cache);
    while (frames.size > 4) frames.delete(frames.keys().next().value);
    return cache;
  }
  async function latest() {
    let failure = false;
    if (!cache || clock() - cache.fetched >= maxAge) {
      pending ||= load().finally(() => {
        pending = null;
      });
      try {
        await pending;
      } catch {
        failure = true;
      }
    }
    if (!cache) throw Error('Satellite provider unavailable. Try again shortly.');
    const ageMinutes = Math.max(0, Math.floor((clock() - Date.parse(cache.observedAt)) / 60000));
    return { ...cache, status: failure || ageMinutes > 90 ? 'stale' : 'available', ageMinutes };
  }
  async function metadata() {
    const x = await latest();
    return {
      status: x.status,
      observedAt: x.observedAt,
      retrievedAt: x.retrievedAt,
      ageMinutes: x.ageMinutes,
      intervalMinutes: 15,
      provider: 'EUMETSAT EUMETView',
      instrument: 'Meteosat SEVIRI IR 10.8 μm · Indian Ocean',
      imageUrl: '/api/environment/satellite/live/image?t=' + encodeURIComponent(x.observedAt),
      source: 'https://user.eumetsat.int/data-access/eumetview',
      interpretation:
        'Near-real-time regional infrared cloud and weather context. This does not measure company emissions or verify ownership of a site.',
    };
  }
  function frameAt(timestamp) {
    // Serve exactly the frame named by the metadata, never a newer unlabelled image.
    const frame = frames.get(timestamp);
    if (!frame) throw Error('Frame expired. Refresh satellite metadata.');
    return frame;
  }
  return { latest, metadata, frameAt };
}
