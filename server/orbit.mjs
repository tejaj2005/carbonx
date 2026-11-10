// Public orbital tracking is separate from EUMETSAT weather imagery.
export function orbitTools({ fetcher = fetch, clock = Date.now } = {}) {
  let cache, pending;
  async function load() {
    const r = await fetcher('https://api.wheretheiss.at/v1/satellites/25544', {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!r.ok) throw Error('ISS position unavailable.');
    const p = await r.json();
    if (
      p.id !== 25544 ||
      p.units !== 'kilometers' ||
      ![p.latitude, p.longitude, p.altitude, p.timestamp].every(Number.isFinite) ||
      Math.abs(p.latitude) > 90 ||
      Math.abs(p.longitude) > 180 ||
      p.altitude < 0 ||
      p.altitude > 10000 ||
      p.timestamp < 0 ||
      p.timestamp * 1000 > clock() + 60000
    )
      throw Error('Invalid orbital position.');
    cache = {
      latitude: p.latitude,
      longitude: p.longitude,
      altitudeKm: p.altitude,
      observedAt: new Date(p.timestamp * 1000).toISOString(),
      retrievedAt: new Date(clock()).toISOString(),
      fetched: clock(),
    };
    return cache;
  }
  async function position() {
    let failed = false;
    if (!cache || clock() - cache.fetched >= 10000) {
      pending ||= load().finally(() => {
        pending = null;
      });
      try {
        await pending;
      } catch {
        failed = true;
      }
    }
    if (!cache) throw Error('ISS position temporarily unavailable.');
    const ageSeconds = Math.max(0, Math.floor((clock() - Date.parse(cache.observedAt)) / 1000));
    return {
      satellite: 'International Space Station',
      id: 25544,
      latitude: cache.latitude,
      longitude: cache.longitude,
      altitudeKm: cache.altitudeKm,
      observedAt: cache.observedAt,
      retrievedAt: cache.retrievedAt,
      ageSeconds,
      status: failed || ageSeconds > 90 ? 'stale' : 'available',
      source: 'https://wheretheiss.at/w/developer',
    };
  }
  return { position };
}
