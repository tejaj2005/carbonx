import { config } from '../server/config.mjs';
import { providers } from '../server/providers.mjs';
import { fetchJson } from '../server/environment.mjs';
import { INDIA_METROS, fetchMetroModel, fetchCpcbStations } from '../server/india.mjs';
import { aiTools } from '../server/ai.mjs';
const rows = [];
const city = INDIA_METROS.find((c) => c.id === 'hyderabad');
const results = await Promise.allSettled([
  fetchMetroModel(city),
  fetchJson(providers.satellite + '/collections/sentinel-2-l2a'),
  process.env.DATA_GOV_IN_API_KEY
    ? fetchCpcbStations(city, process.env.DATA_GOV_IN_API_KEY)
    : Promise.resolve(null),
  process.env.XAI_API_KEY
    ? fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: 'Bearer ' + process.env.XAI_API_KEY.trim() },
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      }).then(async (r) => {
        if (!r.ok) throw Error('HTTP ' + r.status);
        const j = await r.json();
        return Boolean(j.data?.some((m) => m.id === config.aiModel));
      })
    : Promise.resolve(null),
]);
const [model, satellite, station, grok] = results;
rows.push({
  service: 'Weather',
  status: model.status === 'fulfilled' && model.value.weather ? 'connected' : 'unavailable',
});
rows.push({
  service: 'Air quality model',
  status: model.status === 'fulfilled' && model.value.air ? 'connected' : 'unavailable',
});
rows.push({
  service: 'Satellite catalogue',
  status:
    satellite.status === 'fulfilled' && satellite.value.id === 'sentinel-2-l2a'
      ? 'connected'
      : 'unavailable',
});
rows.push({
  service: 'Official CPCB stations',
  status: !process.env.DATA_GOV_IN_API_KEY
    ? 'key required'
    : station.status === 'fulfilled'
      ? station.value.status
      : 'unavailable',
});
rows.push({
  service: 'Grok',
  status: !process.env.XAI_API_KEY
    ? 'key required'
    : grok.status === 'fulfilled'
      ? grok.value
        ? 'key and model verified'
        : 'key accepted; selected model not listed'
      : 'key check failed',
});
if (process.argv.includes('--ai')) {
  const ai = aiTools(config);
  if (!ai.available) rows.push({ service: 'Grok inference', status: 'not configured' });
  else if (config.aiProvider !== 'xai')
    rows.push({ service: 'Grok inference', status: 'select AI_PROVIDER=xai' });
  else {
    try {
      const r = await ai.structured(
        {
          type: 'object',
          additionalProperties: false,
          properties: { status: { type: 'string', enum: ['ok'] } },
          required: ['status'],
        },
        'carbonx_connection_check',
        'Return the requested JSON status. This is a synthetic connection test.',
        'Return status ok.',
      );
      rows.push({
        service: 'Grok inference',
        status: r.data.status === 'ok' ? 'connected' : 'unexpected output',
      });
    } catch {
      rows.push({
        service: 'Grok inference',
        status: 'failed; check key, model access and credits',
      });
    }
  }
} else
  console.log(
    'No AI inference requested. Add -- --ai only when you want a small billable synthetic AI test.',
  );
console.table(rows);
if (
  rows.some(
    (r) =>
      r.status === 'unavailable' || r.status.includes('failed') || r.status === 'unexpected output',
  )
)
  process.exitCode = 1;
