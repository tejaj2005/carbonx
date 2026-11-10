import assert from 'node:assert/strict';
import { aiTools } from '../server/ai.mjs';
import { config } from '../server/config.mjs';
import { TASK_PROMPTS } from '../server/prompts.mjs';
const ai = aiTools(config);
if (!ai.available) throw Error('AI is not configured.');
const chunk = {
  id: 'synthetic-1',
  text: 'Synthetic test facility: Scope 1 greenhouse gas emissions were 120 tonnes CO2e in 2025. Water consumption was 400 cubic metres in 2025.',
  page_number: 1,
  report_name: 'Synthetic verification fixture',
};
const rows = [];
for (const [name, run] of [
  [
    'Claim extraction with exact quotes',
    async () => {
      const claims = await ai.extract([chunk], { year: 2025, boundary: 'Synthetic facility' }, [
        { id: 13, title: 'Climate Action' },
        { id: 6, title: 'Clean Water' },
      ]);
      assert(claims.some((c) => c.metric === 'emissions_scope1' && c.value === 120));
    },
  ],
  [
    'Evidence answer with source citation',
    async () => {
      const result = await ai.answer('What were Scope 1 emissions in 2025?', [chunk]);
      assert(result.citations.includes(chunk.id));
      assert(result.answer.includes('120'));
    },
  ],
  [
    'Evidence action suggestions',
    async () => {
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['actions'],
        properties: {
          actions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['claimId', 'title', 'action', 'priority'],
              properties: {
                claimId: { type: 'string' },
                title: { type: 'string' },
                action: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
            },
          },
        },
      };
      const r = await ai.structured(
        schema,
        'verify_actions',
        TASK_PROMPTS.actions,
        JSON.stringify([
          { id: 'synthetic-claim', finding: 'No metered Scope 1 supporting record provided.' },
        ]),
      );
      assert(r.data.actions.length);
      assert(r.data.actions.every((x) => x.claimId === 'synthetic-claim'));
    },
  ],
  [
    'Monitoring advisory explanation',
    async () => {
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'cautions'],
        properties: {
          summary: { type: 'string' },
          cautions: { type: 'array', items: { type: 'string' } },
        },
      };
      const r = await ai.structured(
        schema,
        'verify_monitoring',
        TASK_PROMPTS.monitoring,
        JSON.stringify({
          source: 'regional CAMS model, not a company measurement',
          pollutant: 'PM2.5',
          reading: 80,
          threshold: 60,
          unit: 'µg/m³',
          basis: 'hourly regional advisory',
          period: 'synthetic fixture',
          evidence: 'No facility measurement supplied.',
        }),
      );
      assert(r.data.summary.length > 20);
      assert(r.data.cautions.length);
    },
  ],
]) {
  try {
    await run();
    rows.push({ feature: name, status: 'passed' });
  } catch (e) {
    rows.push({ feature: name, status: 'FAILED', reason: e.message.slice(0, 180) });
    process.exitCode = 1;
  }
}
console.table(rows);
console.log(
  'Live provider requests using synthetic fixtures only; no real company reports sent. Semantic quality still needs human review.',
);
