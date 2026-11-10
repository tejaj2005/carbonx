import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize,
  verifyClaim,
  parseClaim,
  metricFrom,
  lexicalSearch,
  csvCell,
} from '../server/domain.mjs';
import { indices, assetUrl, atmosphericContext } from '../server/environment.mjs';
import { validateCitations } from '../server/ai.mjs';
import { classificationMetrics } from '../server/evaluation.mjs';
test('units normalise only within the metric family', () => {
  assert.deepEqual(normalize(1000, 'kWh', 'energy_consumption'), { value: 1, unit: 'MWh' });
  assert.deepEqual(normalize(2, 'ML', 'water_consumption'), { value: 2000, unit: 'm3' });
  assert.equal(normalize(10, 'MWh', 'water_consumption'), null);
  assert.equal(normalize(-1, 'kL', 'water_consumption'), null);
});
const c = {
  metric: 'water_consumption',
  year: 2024,
  baseline_year: 2023,
  boundary: 'Site A',
  facility_id: 'f1',
  claimed_change: 20,
  direction: 'decrease',
};
const history = [
  {
    id: 'a',
    metric: c.metric,
    year: 2023,
    boundary: c.boundary,
    facility_id: 'f1',
    normalized_value: 1000,
    normalized_unit: 'm3',
    source: '2023 source',
  },
  {
    id: 'b',
    metric: c.metric,
    year: 2024,
    boundary: c.boundary,
    facility_id: 'f1',
    normalized_value: 800,
    normalized_unit: 'm3',
    source: '2024 source',
  },
];
test('comparison uses the stated percentage-point tolerance', () => {
  assert.equal(verifyClaim(c, history).status, 'supported');
  assert.equal(verifyClaim({ ...c, claimed_change: 23 }, history).status, 'needs_review');
  assert.equal(verifyClaim({ ...c, claimed_change: 22 }, history).status, 'supported');
});
test('scope, missing baselines, duplicate observations and zero baseline abstain', () => {
  assert.equal(verifyClaim({ ...c, boundary: 'Site B' }, history).status, 'insufficient_evidence');
  assert.equal(verifyClaim({ ...c, baseline_year: null }, history).status, 'insufficient_evidence');
  assert.equal(verifyClaim(c, [...history, history[1]]).status, 'insufficient_evidence');
  assert.equal(
    verifyClaim(c, [{ ...history[0], normalized_value: 0 }, history[1]]).status,
    'insufficient_evidence',
  );
});
test('claims preserve an explicit baseline without guessing a missing one', () => {
  const p = parseClaim(
    'In FY2024, water consumption decreased by 20% compared with FY2023, reaching 800 kL.',
    { year: 2024, boundary: 'Site A' },
  );
  assert.equal(p.baseline_year, 2023);
  assert.equal(p.claimed_change, 20);
  assert.equal(p.value, 800);
  assert.equal(
    parseClaim('Water consumption decreased by 20% in FY2024.', { year: 2024 }).baseline_year,
    null,
  );
});
test('retrieval finds the relevant source rather than an unrelated passage', () => {
  const r = lexicalSearch(
    'water consumption',
    [
      { id: 'w', text: 'Water consumption declined in 2024.' },
      { id: 'e', text: 'Electricity generation increased.' },
    ],
    5,
  );
  assert.equal(r[0].id, 'w');
  assert.equal(r.length, 1);
});
test('CSV export neutralises formula-leading cells', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('simple'), '"simple"');
});
test('model quotes must actually occur in cited evidence', () => {
  const chunks = [{ id: 'x', text: 'Water consumption decreased by twenty percent.' }];
  assert.equal(
    validateCitations([{ chunkId: 'x', quote: 'Water consumption decreased' }], chunks).length,
    1,
  );
  assert.equal(
    validateCitations(
      [{ chunkId: 'x', quote: 'The organization is certified and compliant.' }],
      chunks,
    ).length,
    0,
  );
});
test('provider failures produce a partial status without invented readings', async () => {
  const r = await atmosphericContext({ latitude: 17, longitude: 78 }, async (url) => {
    if (url.includes('air-quality')) throw Error('offline');
    return { current: { temperature_2m: 27 } };
  });
  assert.equal(r.status, 'partial');
  assert.equal(r.sources[1].status, 'unavailable');
  assert.equal(r.sources[1].data, undefined);
});
test('imagery URLs enforce the approved source and index calculations mask clouds', () => {
  assert.throws(() => assetUrl('http://127.0.0.1/private'));
  assert.throws(() => assetUrl('https://example.com/B04.tif'));
  const bands = Object.fromEntries(
    ['red', 'nir', 'green'].map((k) => [k, { scale: 1, offset: 0 }]),
  );
  const r = indices(
    Array(40).fill(1),
    Array(40).fill(3),
    Array(40).fill(2),
    Array(40).fill(4),
    bands,
  );
  assert.equal(r.meanNDVI, 0.5);
  assert.ok(Math.abs(r.meanNDWI + 0.2) < 1e-10);
  assert.throws(() =>
    indices(Array(40).fill(1), Array(40).fill(3), Array(40).fill(2), Array(40).fill(8), bands),
  );
});
test('evaluation metrics are computed from supplied labels', () => {
  const r = classificationMetrics(
    ['supported', 'supported', 'needs_review'],
    ['supported', 'needs_review', 'needs_review'],
  );
  assert.equal(r.count, 3);
  assert.equal(r.accuracy, 2 / 3);
  assert.equal(r.matrix.find((x) => x.actual === 'supported').needs_review, 1);
});

test('distinct measurement concepts do not match each other', () => {
  assert.equal(metricFrom('Water recycled reached 80 kL.'), 'water_recycled');
  assert.equal(metricFrom('Water withdrawal reached 80 kL.'), 'water_withdrawal');
  assert.equal(metricFrom('Electricity generated reached 80 MWh.'), 'energy_generated');
  assert.equal(metricFrom('Scope 2 emissions reached 80 tCO2e.'), 'emissions_scope2');
  assert.equal(
    verifyClaim({ ...c, metric: 'water_recycled' }, history).status,
    'insufficient_evidence',
  );
  assert.equal(
    verifyClaim({ ...c, value: 800, unit: 'MWh' }, history).status,
    'insufficient_evidence',
  );
  assert.equal(verifyClaim({ ...c, baseline_year: 2025 }, history).status, 'insufficient_evidence');
});
test('superscript cubic metres and leading-space CSV formulas are handled', () => {
  assert.equal(parseClaim('In FY2024 water consumption reached 800 m³.').value, 800);
  assert.equal(csvCell('  =1+1'), '"\'  =1+1"');
});

test('combined percentage and quantity assertions must both match', () => {
  assert.equal(verifyClaim({ ...c, value: 999, unit: 'kL' }, history).status, 'needs_review');
  assert.equal(verifyClaim({ ...c, value: 800, unit: 'kL' }, history).status, 'supported');
});
test('Indian fiscal periods use the ending year and shares cannot exceed 100 percent', () => {
  const p = parseClaim(
    'In FY2023-24 water consumption declined by 20% compared with FY2022-23, reaching 800 kL.',
    { year: 2024 },
  );
  assert.equal(p.year, 2024);
  assert.equal(p.baseline_year, 2023);
  assert.equal(normalize(150, '%', 'renewable_share'), null);
  assert.deepEqual(normalize(100, '%', 'renewable_share'), { value: 100, unit: '%' });
});
