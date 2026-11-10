import { fetchJson } from './environment.mjs';
import { providers } from './providers.mjs';
export const INDIA_METROS = [
  {
    id: 'delhi',
    name: 'Delhi',
    state: 'Delhi',
    latitude: 28.6139,
    longitude: 77.209,
    cpcbCity: 'Delhi',
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.076,
    longitude: 72.8777,
    cpcbCity: 'Mumbai',
  },
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    state: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    cpcbCity: 'Bengaluru',
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    state: 'Telangana',
    latitude: 17.385,
    longitude: 78.4867,
    cpcbCity: 'Hyderabad',
  },
  {
    id: 'chennai',
    name: 'Chennai',
    state: 'Tamil Nadu',
    latitude: 13.0827,
    longitude: 80.2707,
    cpcbCity: 'Chennai',
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    state: 'West Bengal',
    latitude: 22.5726,
    longitude: 88.3639,
    cpcbCity: 'Kolkata',
  },
  {
    id: 'pune',
    name: 'Pune',
    state: 'Maharashtra',
    latitude: 18.5204,
    longitude: 73.8567,
    cpcbCity: 'Pune',
  },
  {
    id: 'ahmedabad',
    name: 'Ahmedabad',
    state: 'Gujarat',
    latitude: 23.0225,
    longitude: 72.5714,
    cpcbCity: 'Ahmedabad',
  },
];
export const INDIA_SOURCES = {
  model: 'https://open-meteo.com/en/docs/air-quality-api',
  station: 'https://www.data.gov.in/resource/real-time-air-quality-index-various-locations',
  standards: 'https://prana.cpcb.gov.in/ncapDashboard/download_public_portal_file/NCAP_Report.pdf',
  terms: 'https://open-meteo.com/en/terms',
  attribution:
    'Weather and modelled air quality: Open-Meteo and Copernicus Atmosphere Monitoring Service (CAMS). Station summaries, when configured: CPCB via data.gov.in.',
};
export function indiaTimestamp(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  const iso = match
    ? match[3] +
      '-' +
      match[2] +
      '-' +
      match[1] +
      'T' +
      match[4] +
      ':' +
      match[5] +
      ':' +
      (match[6] || '00') +
      '+05:30'
    : value;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function meanModelWindow(hourly, metric, clock = Date.now()) {
  const end = Math.floor(clock / 3600000) * 3600,
    start = end - 24 * 3600;
  const values = [];
  const times = new Set();
  for (let i = 0; i < (hourly?.time || []).length; i++) {
    const t = Number(hourly.time[i]),
      v = hourly[metric]?.[i];
    if (
      t >= start &&
      t < end &&
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= 0 &&
      !times.has(t)
    ) {
      values.push(v);
      times.add(t);
    }
  }
  const ordered = [...times].sort((a, b) => a - b),
    complete =
      ordered.length === 24 &&
      ordered[0] === start &&
      ordered.every((t, i) => i === 0 || t - ordered[i - 1] === 3600);
  return {
    value: complete ? values.reduce((a, b) => a + b, 0) / 24 : null,
    complete,
    samples: values.length,
    windowHours: 24,
    start: new Date(start * 1000).toISOString(),
    end: new Date(end * 1000).toISOString(),
    unit: 'ug/m3',
    basis: 'Modelled hourly output; not measured station compliance data',
  };
}
export async function fetchMetroModel(city, fetcher = fetchJson, clock = Date.now()) {
  const coords =
    'latitude=' +
    city.latitude +
    '&longitude=' +
    city.longitude +
    '&timeformat=unixtime&timezone=GMT';
  const calls = [
    [
      'air',
      providers.airQuality +
        '?' +
        coords +
        '&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide&hourly=pm2_5,pm10&past_days=2&forecast_days=1&domains=cams_global',
    ],
    [
      'weather',
      providers.weather +
        '?' +
        coords +
        '&current=temperature_2m,relative_humidity_2m,wind_speed_10m&forecast_days=1',
    ],
  ];
  const results = await Promise.all(
    calls.map(async ([kind, url]) => {
      try {
        return { kind, status: 'available', data: await fetcher(url) };
      } catch {
        return {
          kind,
          status: 'unavailable',
          error:
            'This public provider request is unavailable. No replacement readings were generated.',
        };
      }
    }),
  );
  const air = results.find((r) => r.kind === 'air'),
    weather = results.find((r) => r.kind === 'weather'),
    a = air.data?.current,
    w = weather.data?.current;
  if (
    a &&
    (!Number.isFinite(a.time) ||
      Date.parse(new Date(a.time * 1000).toISOString()) > clock + 3600000)
  )
    throw Error('Provider air-quality timestamp is invalid.');
  return {
    trend: air.data?.hourly?.time
      ? air.data.hourly.time
          .map((time, i) => ({
            time: new Date(time * 1000).toISOString(),
            pm25: Number.isFinite(air.data.hourly.pm2_5?.[i]) ? air.data.hourly.pm2_5[i] : null,
          }))
          .filter((p) => Date.parse(p.time) < clock)
          .slice(-24)
      : [],
    kind: 'modelled_context',
    status: results.every((r) => r.status === 'available')
      ? 'available'
      : results.some((r) => r.status === 'available')
        ? 'partial'
        : 'unavailable',
    retrievedAt: new Date(clock).toISOString(),
    validAt: a?.time ? new Date(a.time * 1000).toISOString() : null,
    air: a
      ? {
          pm25: a.pm2_5 ?? null,
          pm10: a.pm10 ?? null,
          no2: a.nitrogen_dioxide ?? null,
          so2: a.sulphur_dioxide ?? null,
          co: a.carbon_monoxide ?? null,
          unit: 'ug/m3',
        }
      : null,
    weather: w
      ? {
          temperature: w.temperature_2m,
          humidity: w.relative_humidity_2m,
          wind: w.wind_speed_10m,
          validAt: new Date(w.time * 1000).toISOString(),
        }
      : null,
    means: air.data
      ? [
          { metric: 'pm25', ...meanModelWindow(air.data.hourly, 'pm2_5', clock) },
          { metric: 'pm10', ...meanModelWindow(air.data.hourly, 'pm10', clock) },
        ]
      : [],
    errors: results.filter((r) => r.status === 'unavailable').map((r) => r.kind + ': ' + r.error),
    provider: 'Open-Meteo / CAMS global',
    source: INDIA_SOURCES.model,
    resolution: 'Approximately 45 km; 3-hour native output; model updates every 12 hours',
    interpretation:
      'Actual provider forecast output. This is regional modelled context, not a live local sensor or a company-emissions measurement.',
  };
}
// Public documentation sample key, deliberately published by data.gov.in; 10-record preview only.
export const CPCB_SAMPLE_KEY = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';
export function cpcbAccess(env = process.env) {
  const personal = env.DATA_GOV_IN_API_KEY?.trim();
  return env.CPCB_ACCESS_MODE === 'disabled'
    ? { key: null, mode: 'disabled' }
    : personal
      ? { key: personal, mode: 'personal' }
      : { key: CPCB_SAMPLE_KEY, mode: 'sample' };
}
export async function fetchCpcbStations(city, key, fetcher = fetchJson) {
  if (!key)
    return {
      kind: 'station_summary',
      status: 'not_configured',
      records: [],
      source: INDIA_SOURCES.station,
      note: 'A free personal data.gov.in API key is required for official station summaries.',
    };
  const sample = key === CPCB_SAMPLE_KEY;
  const records = [];
  let total = 0,
    complete = false;
  for (let offset = 0; offset < (sample ? 10 : 5000);) {
    const params = new URLSearchParams({
      'api-key': key,
      format: 'json',
      limit: sample ? '10' : '500',
      offset: String(offset),
      'filters[city]': city.cpcbCity,
    });
    let data;
    try {
      data = await fetcher(
        'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?' + params,
      );
    } catch {
      throw Error(
        'Official CPCB/data.gov.in request failed. Check the server-side key and provider availability.',
      );
    }
    if (!Array.isArray(data.records))
      throw Error('Official provider returned no usable station-record array.');
    total = Number(data.total) || data.records.length;
    for (const r of data.records) {
      const avg = r.pollutant_avg,
        min = r.pollutant_min,
        max = r.pollutant_max;
      const numeric = (v) =>
        v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null;
      records.push({
        station: String(r.station || 'Unnamed station'),
        city: String(r.city || city.name),
        state: String(r.state || city.state),
        pollutant: String(r.pollutant_id || 'Unknown'),
        latitude: numeric(r.latitude),
        longitude: numeric(r.longitude),
        average: numeric(avg),
        minimum: numeric(min),
        maximum: numeric(max),
        observedAt: indiaTimestamp(r.last_update),
        providerTime: r.last_update || null,
        unit: r.unit || null,
        averagingPeriod: r.averaging_period || null,
      });
    }
    if (offset + data.records.length >= total || !data.records.length) {
      complete = true;
      break;
    }
    offset += data.records.length;
  }
  return {
    accessMode: sample ? 'public_sample' : 'personal_key',
    recordLimit: sample ? 10 : 5000,
    kind: 'station_summary',
    status: records.length ? (complete ? 'available' : 'partial') : 'no_records',
    retrievedAt: new Date().toISOString(),
    records,
    total,
    complete,
    source: INDIA_SOURCES.station,
    provider: 'CPCB via data.gov.in',
    note:
      (sample ? 'Public sample preview: at most 10 records; coverage is limited. ' : '') +
      'Provider-reported pollutant summaries. Units and averaging periods remain unknown unless explicitly supplied by the provider; no regulatory comparison is made from unverified fields.',
  };
}
export function assessEmission(rule, sample, clock = Date.now()) {
  const missing = (reason) => ({ status: 'not_assessed', reason });
  if (!sample) return missing('No emissions observation has been supplied.');
  if (
    sample.company_id !== rule.company_id ||
    sample.facility_id !== rule.facility_id ||
    sample.metric !== rule.metric
  )
    return missing('The company, facility or pollutant does not match the configured rule.');
  if (sample.unit !== rule.unit || sample.measurement_basis !== rule.measurement_basis)
    return missing('Units or measurement basis do not match the rule.');
  if (sample.quality !== 'valid' || !Number.isFinite(sample.value) || sample.value < 0)
    return missing('The observation is missing or invalid.');
  const start = Date.parse(sample.period_start),
    end = Date.parse(sample.period_end),
    age = clock - end;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > clock + 60000)
    return missing('The observation period is invalid or in the future.');
  if (Math.abs((end - start) / 60000 - rule.window_minutes) > 1 / 60)
    return missing('The observation averaging/reporting period does not match the rule.');
  if (age > rule.max_age_minutes * 60000) return missing('The observation is stale for this rule.');
  return {
    status: sample.value > rule.threshold ? 'above_threshold' : 'within_configured_threshold',
    value: sample.value,
    threshold: rule.threshold,
    unit: rule.unit,
    reason:
      sample.value > rule.threshold
        ? 'The submitted observation is above this configured operational threshold.'
        : 'The submitted observation is within this configured operational threshold.',
    sourceKind: sample.source_kind,
    legalFinding: false,
  };
}
