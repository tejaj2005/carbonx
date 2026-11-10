import test from 'node:test';
import assert from 'node:assert/strict';
import { aiTools } from '../server/ai.mjs';
import { readConfig } from '../server/config.mjs';
import { providerEndpoints } from '../server/providers.mjs';
test('Grok configuration uses only xAI credentials and is inactive without its key', () => {
  assert.equal(readConfig({}).aiEnabled, false);
  assert.equal(readConfig({}).aiProvider, 'groq');
  const c = readConfig({ XAI_API_KEY: 'fixture-not-a-real-key', AI_PROVIDER: 'grok' });
  assert.equal(c.aiEnabled, true);
  assert.equal(c.aiProvider, 'xai');
  assert.equal(c.aiModel, 'grok-4.7');
  assert.equal(c.embeddingModel, '');
  assert.equal(readConfig({ XAI_API_KEY: 'fixture', ENABLE_HOSTED_AI: 'false' }).aiEnabled, false);
  assert.equal(readConfig({ OPENAI_API_KEY: 'wrong-provider-key' }).aiEnabled, false);
});
test('Grok calls the xAI structured-output endpoint and keeps lexical retrieval without embeddings', async () => {
  const requests = [],
    ai = aiTools(
      { aiEnabled: true, aiProvider: 'xai', aiModel: 'grok-4.7' },
      {
        xaiApiKey: 'fixture-not-a-real-key',
        fetcher: async (url, options) => {
          requests.push({
            url: String(url),
            headers: new Headers(options.headers),
            body: JSON.parse(options.body),
          });
          return new Response(
            JSON.stringify({
              id: 'chat_fixture',
              object: 'chat.completion',
              model: 'grok-4.7',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({ summary: 'Synthetic adapter response' }),
                  },
                  finish_reason: 'stop',
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        },
      },
    );
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: { summary: { type: 'string' } },
  };
  const r = await ai.structured(
    schema,
    'monitoring_explanation',
    'Use supplied facts only',
    'Synthetic fixture',
  );
  assert.equal(r.data.summary, 'Synthetic adapter response');
  assert.equal(ai.provider, 'xai');
  assert.equal(ai.embeddingsAvailable, false);
  assert.equal(await ai.embed(['text']), null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.x.ai/v1/chat/completions');
  assert.equal(requests[0].headers.get('authorization'), 'Bearer fixture-not-a-real-key');
  assert.deepEqual(requests[0].body.response_format.json_schema.schema, schema);
  assert.equal(requests[0].body.response_format.json_schema.strict, true);
});
test('Grok failures do not echo credentials or raw provider responses', async () => {
  const ai = aiTools(
    { aiEnabled: true, aiProvider: 'xai', aiModel: 'grok-4.7' },
    {
      xaiApiKey: 'fixture-not-a-real-key',
      fetcher: async () =>
        new Response(
          JSON.stringify({ error: { message: 'fixture-not-a-real-key private provider detail' } }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    },
  );
  await assert.rejects(
    ai.structured({}, 'check', 'x', 'x'),
    (e) =>
      /401/.test(e.message) &&
      !e.message.includes('fixture-not-a-real-key') &&
      !e.message.includes('private provider detail'),
  );
});
test('keyless environmental endpoints use known HTTPS providers and reject credentials or redirects', () => {
  const p = providerEndpoints({});
  assert.ok(p.weather.includes('api.open-meteo.com'));
  assert.ok(p.satellite.includes('earth-search'));
  assert.throws(
    () => providerEndpoints({ EARTH_SEARCH_STAC_URL: 'https://untrusted.invalid/v1' }),
    /documented HTTPS/,
  );
  assert.throws(
    () =>
      providerEndpoints({
        OPEN_METEO_WEATHER_URL: 'https://secret@api.open-meteo.com/v1/forecast',
      }),
    /documented HTTPS/,
  );
  assert.throws(
    () =>
      providerEndpoints({
        OPEN_METEO_AIR_QUALITY_URL:
          'https://air-quality-api.open-meteo.com/v1/air-quality?apikey=secret',
      }),
    /documented HTTPS/,
  );
});

test('Grok extraction keeps exact report citations and rejects invented answer citations', async () => {
  let payload = {
    claims: [
      {
        chunkId: 'c1',
        quote: 'In FY2024 water consumption reached 800 kL.',
        metric: 'water_consumption',
        value: 800,
        unit: 'kL',
        year: 2024,
        baselineYear: 2023,
        claimedChange: null,
        direction: null,
        sdgs: [6],
        rationale: 'Water usage statement',
      },
    ],
  };
  const ai = aiTools(
    { aiEnabled: true, aiProvider: 'xai', aiModel: 'grok-4.7' },
    {
      xaiApiKey: 'fixture-not-a-real-key',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            model: 'grok-4.7',
            choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    },
  );
  const chunks = [{ id: 'c1', text: 'In FY2024 water consumption reached 800 kL.' }];
  const extracted = await ai.extract(
    chunks,
    { year: 2024, boundary: 'Test site', facility_id: 'f1' },
    [{ id: 6, title: 'Water' }],
  );
  assert.equal(extracted.length, 1);
  assert.equal(extracted[0].method, 'hosted-rag:grok-4.7');
  assert.equal(extracted[0].chunk_id, 'c1');
  payload = { answer: 'Invented reference', citations: ['other'] };
  await assert.rejects(ai.answer('water', chunks), /invalid evidence citation/);
});
