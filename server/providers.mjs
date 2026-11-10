// Public provider endpoints are configurable; private API credentials never appear in returned source URLs.
export function providerEndpoints(env = process.env) {
  const endpoint = (name, fallback, host, pathname) => {
    const u = new URL(env[name] || fallback);
    if (
      u.protocol !== 'https:' ||
      u.hostname !== host ||
      (u.port && u.port !== '443') ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname.replace(/\/$/, '') !== pathname
    ) {
      throw Error(
        name +
          ' must use the documented HTTPS provider endpoint without credentials or query parameters.',
      );
    }
    return u.href.replace(/\/$/, '');
  };
  return {
    weather: endpoint(
      'OPEN_METEO_WEATHER_URL',
      'https://api.open-meteo.com/v1/forecast',
      'api.open-meteo.com',
      '/v1/forecast',
    ),
    airQuality: endpoint(
      'OPEN_METEO_AIR_QUALITY_URL',
      'https://air-quality-api.open-meteo.com/v1/air-quality',
      'air-quality-api.open-meteo.com',
      '/v1/air-quality',
    ),
    satellite: endpoint(
      'EARTH_SEARCH_STAC_URL',
      'https://earth-search.aws.element84.com/v1',
      'earth-search.aws.element84.com',
      '/v1',
    ),
  };
}
export const providers = providerEndpoints();
