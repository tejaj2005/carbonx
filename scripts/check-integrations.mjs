import { orbitTools } from '../server/orbit.mjs';
import { satelliteTools } from '../server/live-satellite.mjs';
import { config } from '../server/config.mjs';
import { providers } from '../server/providers.mjs';
import { fetchJson } from '../server/environment.mjs';
import { INDIA_METROS, fetchMetroModel, fetchCpcbStations, cpcbAccess } from '../server/india.mjs';
import { aiTools } from '../server/ai.mjs';
import { satelliteProvider, sentinelHubTools } from '../server/sentinelhub.mjs';
const groq = config.aiProvider === 'groq',
  xai = config.aiProvider === 'xai';
const key = groq ? process.env.GROQ_API_KEY : xai ? process.env.XAI_API_KEY : null;
const results = await Promise.allSettled([
  fetchMetroModel(INDIA_METROS.find((c) => c.id === 'hyderabad')),
  fetchJson(providers.satellite + '/collections/sentinel-2-l2a'),
  cpcbAccess().key
    ? fetchCpcbStations(
        INDIA_METROS.find((c) => c.id === 'hyderabad'),
        cpcbAccess().key,
      )
    : Promise.resolve(null),
  key
    ? fetch(groq ? 'https://api.groq.com/openai/v1/models' : 'https://api.x.ai/v1/models', {
        headers: { Authorization: 'Bearer ' + key.trim() },
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      }).then(async (r) => {
        if (!r.ok) throw Error('HTTP ' + r.status);
        return Boolean((await r.json()).data?.some((m) => m.id === config.aiModel));
      })
    : Promise.resolve(null),
  satelliteProvider() === 'sentinelhub'
    ? sentinelHubTools()
        .accessToken()
        .then(() => true)
    : Promise.resolve(null),
]);
const [model, satellite, station, aiCheck, copernicus] = results;
const rows = [
  {
    service: 'Weather',
    status: model.status === 'fulfilled' && model.value.weather ? 'connected' : 'unavailable',
  },
  {
    service: 'Air quality model',
    status: model.status === 'fulfilled' && model.value.air ? 'connected' : 'unavailable',
  },
  {
    service: 'Earth Search catalogue',
    status:
      satellite.status === 'fulfilled' && satellite.value.id === 'sentinel-2-l2a'
        ? 'connected'
        : 'unavailable',
  },
  {
    service: 'Official CPCB stations',
    status: !cpcbAccess().key
      ? 'key required'
      : station.status === 'fulfilled'
        ? station.value.status
        : 'unavailable',
  },
  {
    service: groq ? 'Groq' : xai ? 'Grok / xAI' : 'AI',
    status: !key
      ? 'key required'
      : aiCheck.status === 'fulfilled'
        ? aiCheck.value
          ? 'key and model verified'
          : 'key accepted; selected model not listed'
        : 'key check failed',
  },
  {
    service: 'Copernicus Sentinel Hub',
    status:
      satelliteProvider() !== 'sentinelhub'
        ? 'optional; not selected'
        : copernicus.status === 'fulfilled'
          ? 'OAuth verified; imagery not tested'
          : 'credential check failed',
  },
];
try {
  const frame = await satelliteTools().metadata();
  rows.push({
    service: 'EUMETSAT India satellite',
    status: frame.status === 'available' ? 'connected; near real time' : 'stale provider frame',
    observedAt: frame.observedAt,
  });
} catch {
  rows.push({ service: 'EUMETSAT India satellite', status: 'unavailable' });
}
try {
  const p = await orbitTools().position();
  rows.push({
    service: 'Live ISS coordinates',
    status: p.status === 'available' ? 'connected' : 'stale provider position',
  });
} catch {
  rows.push({ service: 'Live ISS coordinates', status: 'unavailable' });
}
if (process.argv.includes('--ai')) {
  const ai = aiTools(config);
  if (!ai.available) rows.push({ service: 'AI inference', status: 'not configured' });
  else
    try {
      const r = await ai.structured(
        {
          type: 'object',
          additionalProperties: false,
          properties: { status: { type: 'string', enum: ['ok'] } },
          required: ['status'],
        },
        'carbonx_connection_check',
        'Return the requested status. Synthetic connection test.',
        'Return status ok.',
      );
      rows.push({
        service: 'AI inference',
        status: r.data.status === 'ok' ? 'connected' : 'unexpected output',
      });
    } catch {
      rows.push({
        service: 'AI inference',
        status: 'failed; check key, model access, rate limits and credits',
      });
    }
} else
  console.log(
    'No AI inference requested. Use -- --ai for a small synthetic test subject to your account limits/billing.',
  );
console.table(rows);
if (
  rows.some(
    (r) =>
      r.status === 'unavailable' || r.status.includes('failed') || r.status === 'unexpected output',
  )
)
  process.exitCode = 1;
