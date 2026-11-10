import test from 'node:test';
import assert from 'node:assert/strict';
import { aiTools } from '../server/ai.mjs';

test('free local AI uses structured Ollama and embedding contracts without a hosted request', async () => {
  const previous = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () =>
        url.endsWith('/api/embed')
          ? { embeddings: [[0.2, 0.8]] }
          : { response: JSON.stringify({ summary: 'Fixture only' }), model: 'local-test' },
    };
  };
  try {
    const ai = aiTools({
      aiEnabled: true,
      aiProvider: 'ollama',
      aiModel: 'local-test',
      embeddingModel: 'embed-test',
    });
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    };
    assert.equal(
      (await ai.structured(schema, 'explanation', 'Explain with supplied evidence only', 'Fixture'))
        .data.summary,
      'Fixture only',
    );
    assert.deepEqual(await ai.embed(['Fixture']), [[0.2, 0.8]]);
    assert.equal(ai.provider, 'ollama');
    assert.ok(calls.every((c) => c.url.startsWith('http://127.0.0.1:11434/')));
    assert.deepEqual(calls[0].body.format, schema);
    assert.equal(calls[0].body.stream, false);
    assert.equal(calls[0].redirect, 'error');
    assert.equal(calls[1].body.truncate, false);
  } finally {
    globalThis.fetch = previous;
  }
});

test('unconfigured local AI stays unavailable and explicitly cloud-labelled models are rejected', async () => {
  const unavailable = aiTools({ aiEnabled: false, aiProvider: 'ollama' });
  assert.equal(unavailable.available, false);
  await assert.rejects(unavailable.structured({}, 'x', 'x', 'x'), /not configured/);
  const cloud = aiTools({ aiEnabled: true, aiProvider: 'ollama', aiModel: 'model-cloud' });
  await assert.rejects(cloud.structured({}, 'x', 'x', 'x'), /explicitly local/);
});
