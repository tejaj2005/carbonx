import { baselineMapping, lexicalSearch } from './domain.mjs';
export function classificationMetrics(expected, predicted) {
  const labels = [...new Set([...expected, ...predicted])];
  let macro = 0;
  const perLabel = labels.map((label) => {
    let tp = 0,
      fp = 0,
      fn = 0;
    for (let i = 0; i < expected.length; i++) {
      if (expected[i] === label && predicted[i] === label) tp++;
      else if (predicted[i] === label) fp++;
      else if (expected[i] === label) fn++;
    }
    const precision = tp + fp ? tp / (tp + fp) : 0,
      recall = tp + fn ? tp / (tp + fn) : 0,
      f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    macro += f1;
    return { label, precision, recall, f1, support: tp + fn };
  });
  const matrix = labels.map((actual) => ({
    actual,
    ...Object.fromEntries(
      labels.map((pred) => [
        pred,
        expected.filter((x, i) => x === actual && predicted[i] === pred).length,
      ]),
    ),
  }));
  return {
    count: expected.length,
    accuracy: expected.length
      ? expected.filter((x, i) => x === predicted[i]).length / expected.length
      : null,
    macroF1: labels.length ? macro / labels.length : null,
    perLabel,
    matrix,
  };
}
function multiLabel(expected, predicted) {
  let tp = 0,
    fp = 0,
    fn = 0;
  for (let i = 0; i < expected.length; i++) {
    const a = new Set(expected[i]),
      b = new Set(predicted[i]);
    for (const x of b) a.has(x) ? tp++ : fp++;
    for (const x of a) if (!b.has(x)) fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0,
    recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    precision,
    recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
  };
}
export function evaluate(store, company) {
  const cases = store.q(
    'SELECT e.*,c.text,c.sdgs_json,c.status FROM evaluation_cases e JOIN claims c ON c.id=e.claim_id WHERE e.company_id=? AND e.split=?',
    company,
    'test',
  );
  if (!cases.length) {
    const e = new Error('Add held-out test labels before running an evaluation.');
    e.status = 400;
    throw e;
  }
  const chunks = store.q('SELECT id,text FROM chunks WHERE company_id=?', company);
  const expected = cases.map((c) => JSON.parse(c.expected_sdgs)),
    baseline = cases.map((c) => baselineMapping(c.text)),
    pipeline = cases.map((c) => JSON.parse(c.sdgs_json));
  const retrieval = cases
    .filter((c) => JSON.parse(c.relevant_chunks).length)
    .map((c) => {
      const gold = new Set(JSON.parse(c.relevant_chunks)),
        got = lexicalSearch(c.text, chunks, 5);
      return got.filter((x) => gold.has(x.id)).length / gold.size;
    });
  return {
    evaluatedAt: new Date().toISOString(),
    testCases: cases.length,
    baselineMapping: multiLabel(expected, baseline),
    pipelineMapping: multiLabel(expected, pipeline),
    claimStatus: classificationMetrics(
      cases.map((c) => c.expected_status),
      cases.map((c) => c.status),
    ),
    lexicalRecallAt5: retrieval.length
      ? retrieval.reduce((a, b) => a + b, 0) / retrieval.length
      : null,
    retrievalCases: retrieval.length,
    note: 'Measured against labels stored in this workspace. The test split is excluded from prompt development by convention; CarbonX does not train a model. These measurements do not reproduce the review deck benchmarks.',
  };
}
