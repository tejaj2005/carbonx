export const SDGS = [
  [1, 'No poverty', '#e5243b', 'poverty|livelihood|low-income'],
  [2, 'Zero hunger', '#dda63a', 'hunger|nutrition|food security|agriculture'],
  [3, 'Good health and well-being', '#4c9f38', 'health|safety|injur|well-being'],
  [4, 'Quality education', '#c5192d', 'education|training|literacy'],
  [5, 'Gender equality', '#ff3a21', 'gender|women|female|equal pay'],
  [6, 'Clean water and sanitation', '#26bde2', 'water|sanitation|effluent'],
  [7, 'Affordable and clean energy', '#fcc30b', 'energy|electricity|renewable|solar|wind power'],
  [8, 'Decent work and economic growth', '#a21942', 'employment|labour|labor|workers|decent work'],
  [
    9,
    'Industry innovation and infrastructure',
    '#fd6925',
    'manufactur|industrial|infrastructure|innovation|efficiency',
  ],
  [10, 'Reduced inequalities', '#dd1367', 'inequal|inclusion|disab'],
  [11, 'Sustainable cities and communities', '#fd9d24', 'cities|urban|communities|transport'],
  [
    12,
    'Responsible consumption and production',
    '#bf8b2e',
    'waste|recycl|circular|resource|consumption',
  ],
  [13, 'Climate action', '#3f7e44', 'emission|carbon|co2|climate|greenhouse'],
  [14, 'Life below water', '#0a97d9', 'ocean|marine|coastal'],
  [15, 'Life on land', '#56c02b', 'forest|vegetation|biodiversity|land|habitat'],
  [
    16,
    'Peace justice and strong institutions',
    '#00689d',
    'governance|corruption|ethics|transparency',
  ],
  [17, 'Partnerships for the goals', '#19486a', 'partnership|collaboration|stakeholder'],
].map(([id, title, color, keywords]) => ({
  id,
  title,
  color,
  keywords,
  source: 'https://sdgs.un.org/goals/goal' + id,
}));
export const METRICS = [
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
];
export function baselineMapping(text) {
  return SDGS.filter((g) => new RegExp(g.keywords, 'i').test(text))
    .slice(0, 4)
    .map((g) => g.id);
}
export function metricFrom(text) {
  if (/renewable.*(?:share|%|percent)|(?:share|%).*renewable/i.test(text)) return 'renewable_share';
  if (/water|effluent/i.test(text)) {
    if (/recycl|reus/i.test(text)) return 'water_recycled';
    if (/withdraw|abstract|intake/i.test(text)) return 'water_withdrawal';
    if (/consum|usage|\buse\b|\bused\b/i.test(text)) return 'water_consumption';
    return null;
  }
  if (/emission|carbon|co2|greenhouse/i.test(text)) {
    for (const s of [1, 2, 3])
      if (new RegExp('scope[ -]*' + s, 'i').test(text)) return 'emissions_scope' + s;
    return 'emissions';
  }
  if (/energy|electricity|power|kwh|mwh/i.test(text)) {
    if (/generat|produc/i.test(text)) return 'energy_generated';
    if (/consum|usage|\buse\b|\bused\b|reduc/i.test(text)) return 'energy_consumption';
    return null;
  }
  if (/waste|recycl/i.test(text))
    return /recycl|reus/i.test(text) ? 'waste_recycled' : 'waste_generated';
  if (/land|forest|vegetation|hectare/i.test(text)) return 'land_area';
  return null;
}
export function normalize(value, unit, metric) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    !unit
  )
    return null;
  const u = unit.toLowerCase().replace(/[³]/g, '3').replace(/[₂]/g, '2').replace(/\s/g, '');
  const units = {
    kl: ['m3', 1],
    m3: ['m3', 1],
    ml: ['m3', 1000],
    litre: ['m3', 0.001],
    litres: ['m3', 0.001],
    liter: ['m3', 0.001],
    liters: ['m3', 0.001],
    kwh: ['MWh', 0.001],
    mwh: ['MWh', 1],
    gwh: ['MWh', 1000],
    gj: ['MWh', 1 / 3.6],
    tj: ['MWh', 1000 / 3.6],
    tco2e: ['tCO2e', 1],
    ktco2e: ['tCO2e', 1000],
    kgco2e: ['tCO2e', 0.001],
    tonne: ['tonnes', 1],
    tonnes: ['tonnes', 1],
    ton: ['tonnes', 1],
    tons: ['tonnes', 1],
    t: ['tonnes', 1],
    kg: ['tonnes', 0.001],
    ha: ['ha', 1],
    hectares: ['ha', 1],
    '%': ['%', 1],
    percent: ['%', 1],
  };
  const n = units[u];
  if (!n) return null;
  const expected = {
    water_consumption: 'm3',
    water_withdrawal: 'm3',
    water_recycled: 'm3',
    energy_consumption: 'MWh',
    energy_generated: 'MWh',
    emissions: 'tCO2e',
    emissions_scope1: 'tCO2e',
    emissions_scope2: 'tCO2e',
    emissions_scope3: 'tCO2e',
    waste_generated: 'tonnes',
    waste_recycled: 'tonnes',
    renewable_share: '%',
    land_area: 'ha',
  }[metric];
  if (expected && n[0] !== expected) return null;
  if (metric === 'renewable_share' && Number(value) > 100) return null;
  return { value: Number(value) * n[1], unit: n[0] };
}
export function parseClaim(text, meta = {}) {
  const metric = metricFrom(text);
  const quantity = text.match(
    /([\d,]+(?:\.\d+)?)\s*(kt\s*CO[₂2]e|kg\s*CO[₂2]e|t\s*CO[₂2]e|MWh|GWh|kWh|kL|m[³3]|ML|GJ|TJ|tonnes|tons|tonne|kg|litres|liters|litre|liter|hectares|ha)(?![\p{L}\p{N}])/iu,
  );
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
  const direction = /reduc|decreas|lower|cut\b|sav(?:e|ing)/i.test(text)
    ? 'decrease'
    : /increas|grow|higher/i.test(text)
      ? 'increase'
      : null;
  const years = [...text.matchAll(/\b(?:FY\s*)?(20\d{2})\b/g)].map((x) => Number(x[1]));
  const fiscalEnd = (start, end) => {
    if (!end) return Number(start);
    const n = end.length === 2 ? Math.floor(Number(start) / 100) * 100 + Number(end) : Number(end);
    return n < Number(start) ? n + 100 : n;
  };
  for (const f of text.matchAll(/\b(?:FY\s*)?(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b/g))
    years.push(fiscalEnd(f[1], f[2]));
  const explicitBaseline = text.match(
    /(?:from|versus|vs\.?|compared (?:with|to)|against)\s*(?:FY\s*)?(20\d{2})(?:\s*[-–/]\s*(20\d{2}|\d{2}))?/i,
  );
  return {
    text,
    metric,
    value: quantity
      ? Number(quantity[1].replaceAll(',', ''))
      : metric === 'renewable_share' && pct
        ? Number(pct[1])
        : null,
    unit: quantity
      ? quantity[2].replace(/\s/g, '')
      : metric === 'renewable_share' && pct
        ? '%'
        : null,
    year: years.length ? Math.max(...years) : meta.year || null,
    baseline_year: explicitBaseline ? fiscalEnd(explicitBaseline[1], explicitBaseline[2]) : null,
    boundary: meta.boundary || null,
    facility_id: meta.facility_id || null,
    claimed_change: pct && direction ? Number(pct[1]) : null,
    direction,
    sdgs: baselineMapping(text),
    rationale: 'Keyword baseline mapping; review the cited passage and suggested goals.',
    method: 'keyword-baseline',
  };
}
export function extractBaseline(chunks, meta) {
  const output = [],
    seen = new Set();
  for (const chunk of chunks) {
    for (const sentence of chunk.text.split(/(?<=[.!?])\s+|\n+/)) {
      const text = sentence.trim();
      if (
        text.length < 30 ||
        text.length > 1500 ||
        seen.has(text) ||
        !baselineMapping(text).length ||
        !/\d|reduc|improv|commit|install|recycl|conserv/i.test(text)
      )
        continue;
      seen.add(text);
      output.push({ ...parseClaim(text, meta), chunk_id: chunk.id });
      if (output.length >= 400) return output;
    }
  }
  return output;
}
function scope(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
export function verifyClaim(claim, observations) {
  const reasons = [];
  const insufficient = (message) => ({
    status: 'insufficient_evidence',
    reasons: [message],
    comparison: {},
  });
  if (!claim.metric || !claim.year || !scope(claim.boundary))
    return insufficient('Metric, reporting year and reporting boundary must be recorded.');
  const candidates = observations.filter(
    (x) =>
      x.metric === claim.metric &&
      scope(x.boundary) === scope(claim.boundary) &&
      (x.facility_id || null) === (claim.facility_id || null),
  );
  if (
    claim.unit &&
    claim.value !== null &&
    claim.value !== undefined &&
    !normalize(claim.value, claim.unit, claim.metric)
  )
    return insufficient(
      'The extracted quantity unit is incompatible with its metric. Correct it before comparison.',
    );
  if (!candidates.length)
    return insufficient(
      'No historical observations match this metric, facility and reporting boundary.',
    );
  const current = candidates.filter((x) => x.year === claim.year);
  if (current.length !== 1)
    return insufficient(
      current.length
        ? 'Multiple observations exist for this year and scope. Resolve the ambiguity before comparison.'
        : 'No observation matches the claim reporting year.',
    );
  const c = current[0];
  let comparison = {
    current: {
      id: c.id,
      year: c.year,
      value: c.normalized_value,
      unit: c.normalized_unit,
      source: c.source,
    },
  };
  if (claim.claimed_change !== null && claim.claimed_change !== undefined) {
    if (!claim.baseline_year || !claim.direction)
      return insufficient(
        'A percentage-change claim needs an explicit baseline year and direction. Add these after checking the source.',
      );
    if (claim.baseline_year >= claim.year)
      return insufficient('Baseline year must precede the current reporting year.');
    const baseline = candidates.filter(
      (x) => x.year === claim.baseline_year && x.normalized_unit === c.normalized_unit,
    );
    if (baseline.length !== 1)
      return insufficient(
        baseline.length
          ? 'Multiple baseline observations exist. Resolve the ambiguity before comparison.'
          : 'A matching baseline observation and unit are required.',
      );
    const b = baseline[0];
    if (b.normalized_value === 0)
      return insufficient('A percentage change cannot be calculated from a zero baseline.');
    const computed =
      ((claim.direction === 'decrease'
        ? b.normalized_value - c.normalized_value
        : c.normalized_value - b.normalized_value) /
        b.normalized_value) *
      100;
    const difference = Math.abs(computed - claim.claimed_change);
    comparison = {
      ...comparison,
      baseline: {
        id: b.id,
        year: b.year,
        value: b.normalized_value,
        unit: b.normalized_unit,
        source: b.source,
      },
      claimedChange: claim.claimed_change,
      computedChange: computed,
      differencePercentagePoints: difference,
      tolerancePercentagePoints: 2,
    };
    reasons.push(
      difference > 2
        ? 'Claimed change differs from the historical calculation by more than 2 percentage points.'
        : 'Claimed change is within 2 percentage points of the historical calculation.',
    );
    let quantityMismatch = false;
    if (claim.value !== null && claim.value !== undefined) {
      const quantity = normalize(claim.value, claim.unit, claim.metric);
      if (!quantity || quantity.unit !== c.normalized_unit)
        return insufficient('The explicit quantity has no compatible unit for this comparison.');
      const difference = Math.abs(quantity.value - c.normalized_value),
        tolerance = Math.max(0.000001, Math.abs(c.normalized_value) * 0.005);
      quantityMismatch = difference > tolerance;
      comparison.explicitQuantity = {
        claimed: quantity.value,
        recorded: c.normalized_value,
        unit: quantity.unit,
        difference,
        tolerance,
      };
      reasons.push(
        quantityMismatch
          ? 'The explicit current-year quantity contradicts the matching historical observation.'
          : 'The explicit current-year quantity also matches the recorded observation.',
      );
    }
    return {
      status: difference > 2 || quantityMismatch ? 'needs_review' : 'supported',
      reasons,
      comparison,
    };
  }
  const n = normalize(claim.value, claim.unit, claim.metric);
  if (!n || n.unit !== c.normalized_unit)
    return insufficient(
      'A reported quantity and compatible units are required for a direct-value comparison.',
    );
  const diff = Math.abs(n.value - c.normalized_value),
    tolerance = Math.max(0.000001, Math.abs(c.normalized_value) * 0.005);
  comparison = {
    ...comparison,
    claimedValue: n.value,
    unit: n.unit,
    absoluteDifference: diff,
    tolerance,
  };
  return {
    status: diff > tolerance ? 'needs_review' : 'supported',
    reasons: [
      diff > tolerance
        ? 'Reported quantity differs from the matching historical observation.'
        : 'Reported quantity agrees with the matching observation within the 0.5% rounding tolerance.',
    ],
    comparison,
  };
}
const stop = new Set(
  'the a an and or of to for in on with by from we our is are was were at as it this that has have report year'.split(
    ' ',
  ),
);
export function tokens(text) {
  return (
    String(text)
      .toLowerCase()
      .match(/[a-z0-9]{2,}/g)
      ?.filter((x) => !stop.has(x)) || []
  );
}
export function lexicalSearch(query, chunks, k = 5) {
  const qt = new Set(tokens(query));
  if (!qt.size) return [];
  const df = new Map();
  for (const c of chunks) for (const t of new Set(tokens(c.text))) df.set(t, (df.get(t) || 0) + 1);
  const ranked = chunks
    .map((c) => {
      const terms = tokens(c.text),
        freq = new Map();
      for (const t of terms) freq.set(t, (freq.get(t) || 0) + 1);
      let score = 0;
      for (const t of qt) {
        const f = freq.get(t) || 0;
        if (f)
          score +=
            Math.log(1 + f) * (Math.log(1 + (chunks.length + 1) / ((df.get(t) || 0) + 1)) + 1);
      }
      return { ...c, score: score / Math.sqrt(Math.max(1, terms.length)) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, k);
}
export function cosine(a, b) {
  if (a.length !== b.length || !a.length) return 0;
  let d = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    x += a[i] ** 2;
    y += b[i] ** 2;
  }
  return x && y ? d / Math.sqrt(x * y) : 0;
}
export function csvCell(value) {
  const s = String(value ?? '');
  return '"' + (/^[\s]*[=+\-@]|^[\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
}
