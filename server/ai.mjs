import OpenAI from 'openai';
import { z } from 'zod';
import { AI_POLICY, TASK_PROMPTS } from './prompts.mjs';
export const claimSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['claims'],
  properties: {
    claims: {
      type: 'array',
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'chunkId',
          'quote',
          'metric',
          'value',
          'unit',
          'year',
          'baselineYear',
          'claimedChange',
          'direction',
          'sdgs',
          'rationale',
        ],
        properties: {
          chunkId: { type: 'string' },
          quote: { type: 'string' },
          metric: {
            type: ['string', 'null'],
            enum: [
              'water_consumption',
              'water_withdrawal',
              'water_recycled',
              'energy_consumption',
              'energy_generated',
              'emissions',
              'emissions_scope1',
              'emissions_scope2',
              'emissions_scope3',
              'waste_generated',
              'waste_recycled',
              'renewable_share',
              'land_area',
              null,
            ],
          },
          value: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          year: { type: ['integer', 'null'] },
          baselineYear: { type: ['integer', 'null'] },
          claimedChange: { type: ['number', 'null'] },
          direction: { type: ['string', 'null'], enum: ['increase', 'decrease', null] },
          sdgs: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 17 }, maxItems: 4 },
          rationale: { type: 'string' },
        },
      },
    },
  },
};
const normalizeSpace = (s) => s.replace(/\s+/g, ' ').trim();
export function validateCitations(items, chunks) {
  return items.filter((x) => {
    const c = chunks.find((c) => c.id === x.chunkId);
    return (
      c &&
      x.quote &&
      x.quote.length >= 20 &&
      normalizeSpace(c.text).includes(normalizeSpace(x.quote))
    );
  });
}
export function aiTools(
  config,
  {
    fetcher = fetch,
    xaiApiKey = process.env.XAI_API_KEY,
    groqApiKey = process.env.GROQ_API_KEY,
  } = {},
) {
  const local = config.aiEnabled && config.aiProvider === 'ollama';
  const localPost = async (path, body) => {
    for (const name of [body.model])
      if (!name || /cloud/i.test(name)) throw Error('Choose an explicitly local Ollama model.');
    const response = await fetcher('http://127.0.0.1:11434' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
      redirect: 'error',
    });
    if (!response.ok)
      throw Error(
        'Local Ollama returned HTTP ' +
          response.status +
          '. Confirm the local service and installed model.',
      );
    return response.json();
  };
  const xai = config.aiEnabled && config.aiProvider === 'xai' && Boolean(xaiApiKey?.trim());
  const groq = config.aiEnabled && config.aiProvider === 'groq' && Boolean(groqApiKey?.trim());
  const xaiClient =
    xai || groq
      ? new OpenAI({
          apiKey: (groq ? groqApiKey : xaiApiKey).trim(),
          baseURL: groq ? 'https://api.groq.com/openai/v1' : 'https://api.x.ai/v1',
          timeout: 120000,
          maxRetries: 0,
          fetch: fetcher,
          fetchOptions: { redirect: 'error' },
        })
      : null;
  const client =
    config.aiEnabled && config.aiProvider === 'openai' && process.env.ALLOW_PAID_AI === 'true'
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 2 })
      : null;
  async function structured(schema, name, instructions, input) {
    if (xaiClient) {
      try {
        const result = await xaiClient.chat.completions.create({
          model: config.aiModel,
          messages: [
            { role: 'system', content: AI_POLICY + '\n\n' + instructions },
            { role: 'user', content: input },
          ],
          response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
          ...(groq ? { max_completion_tokens: 7000 } : { max_tokens: 7000 }),
        });
        const choice = result.choices?.[0];
        if (!choice?.message?.content || (choice.finish_reason && choice.finish_reason !== 'stop'))
          throw Error('Incomplete structured output');
        const data = JSON.parse(choice.message.content);
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw Error('Invalid structured output');
        if (!z.fromJSONSchema(schema).safeParse(data).success)
          throw Error('Invalid structured output');
        return { data, model: result.model || config.aiModel };
      } catch (e) {
        const status = Number.isInteger(e.status) ? ' HTTP ' + e.status : '';
        throw Error(
          (groq ? 'Groq request failed' : 'Grok request failed') +
            status +
            '. Check ' +
            (groq ? 'GROQ_API_KEY' : 'XAI_API_KEY') +
            ', model access, rate limits and account credits.',
        );
      }
    }
    if (local) {
      const result = await localPost('/api/generate', {
        model: config.aiModel,
        system: instructions,
        prompt: input + '\nReturn JSON matching this schema: ' + JSON.stringify(schema),
        format: schema,
        stream: false,
        options: { temperature: 0 },
      });
      if (!result.response) throw Error('The local model returned no structured output.');
      return { data: JSON.parse(result.response), model: result.model || config.aiModel };
    }
    if (!client)
      throw new Error(
        'AI is not configured. Add the selected provider API key to the server .env file and restart CarbonX.',
      );
    const result = await client.responses.create({
      model: config.aiModel,
      store: false,
      instructions,
      input,
      text: { format: { type: 'json_schema', name, strict: true, schema } },
      max_output_tokens: 7000,
    });
    if (!result.output_text) throw new Error('The model returned no usable structured output.');
    return { data: JSON.parse(result.output_text), model: result.model };
  }
  async function embed(texts) {
    if (['xai', 'groq'].includes(config.aiProvider)) return null;
    if (local) {
      if (!config.embeddingModel)
        throw Error(
          'A local embedding model is not configured. Lexical retrieval remains available.',
        );
      const result = await localPost('/api/embed', {
        model: config.embeddingModel,
        input: texts,
        truncate: false,
      });
      return result.embeddings;
    }
    if (!client) return null;
    const result = await client.embeddings.create({ model: config.embeddingModel, input: texts });
    return result.data.sort((a, b) => a.index - b.index).map((x) => x.embedding);
  }
  async function extract(chunks, meta, goals) {
    const result = [];
    let rejected = 0;
    for (let i = 0; i < chunks.length; i += 6) {
      const batch = chunks.slice(i, i + 6);
      const response = await structured(
        claimSchema,
        'carbonx_claims',
        TASK_PROMPTS.extract,
        JSON.stringify({
          metadata: { year: meta.year, boundary: meta.boundary },
          sdgReference: goals.map((g) => ({ id: g.id, title: g.title })),
          passages: batch.map((c) => ({ id: c.id, text: c.text })),
        }),
      );
      const valid = validateCitations(response.data.claims || [], batch);
      rejected += (response.data.claims || []).length - valid.length;
      for (const item of valid)
        result.push({
          text: item.quote,
          chunk_id: item.chunkId,
          metric: item.metric,
          value: item.value,
          unit: item.unit,
          year: item.year ?? meta.year,
          baseline_year: item.baselineYear,
          claimed_change: item.claimedChange,
          direction: item.direction,
          boundary: meta.boundary,
          facility_id: meta.facility_id,
          sdgs: [...new Set(item.sdgs)],
          rationale: item.rationale,
          method: (local ? 'local-rag:' : 'hosted-rag:') + response.model,
        });
    }
    if (rejected && !result.length) throw new Error('No model proposal had a valid source quote.');
    result.rejectedQuotes = rejected;
    return result;
  }
  async function answer(query, passages) {
    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['answer', 'citations'],
      properties: {
        answer: { type: 'string' },
        citations: { type: 'array', items: { type: 'string' } },
      },
    };
    const response = await structured(
      schema,
      'carbonx_evidence_answer',
      TASK_PROMPTS.answer,
      JSON.stringify({
        question: query,
        passages: passages.map((p) => ({
          id: p.id,
          text: p.text,
          page: p.page_number,
          report: p.report_name,
        })),
      }),
    );
    const allowed = new Set(passages.map((p) => p.id));
    if (response.data.citations.some((id) => !allowed.has(id)))
      throw new Error('The answer contained an invalid evidence citation.');
    if (passages.length && !response.data.citations.length)
      throw new Error('The answer contained no supporting evidence citations.');
    return { ...response.data, model: response.model };
  }
  return {
    structured,
    embed,
    extract,
    answer,
    available: local || Boolean(xaiClient) || Boolean(client),
    embeddingsAvailable:
      !['xai', 'groq'].includes(config.aiProvider) &&
      Boolean(config.embeddingModel) &&
      (local || Boolean(client)),
    provider: local ? 'ollama' : xaiClient ? (groq ? 'groq' : 'xai') : client ? 'openai' : 'none',
  };
}
