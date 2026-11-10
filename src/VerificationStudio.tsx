import React, { useEffect, useState } from 'react';
import {
  Satellite,
  MapPin,
  Wind,
  ShieldCheck,
  Activity,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  Check,
  ExternalLink,
  Database,
} from 'lucide-react';
import { SatelliteScene } from './VisualJourney';
import { date, number, type Item } from './api';
import { integrations, demoVerification as demo } from './data/integrations';

const stages = [
  ['Location', MapPin],
  ['Air quality', Wind],
  ['Satellite', Satellite],
  ['Emissions', Activity],
  ['Review', ShieldCheck],
] as const;
export function SourceInventory() {
  return (
    <section className="source-inventory" aria-label="API and data sources">
      <div className="section-intro">
        <span className="eyebrow">TRANSPARENT BY DESIGN</span>
        <h2>Know where every result comes from.</h2>
        <p>Provider data, company evidence and presentation simulations have different purposes.</p>
      </div>
      <div className="source-catalogue">
        {integrations.map((s) => (
          <details key={s.id}>
            <summary>
              <span>
                <strong>{s.name}</strong>
                <small>{s.type}</small>
              </span>
              <span aria-hidden="true">+</span>
            </summary>
            <div>
              <p>{s.features}</p>
              <p>
                <b>Connection:</b> {s.status}
              </p>
              <p>
                <b>Interpretation:</b> {s.limitations}
              </p>
              {s.source && (
                <a className="text-link" href={s.source} target="_blank" rel="noreferrer">
                  Official source <ExternalLink size={14} />
                </a>
              )}
            </div>
          </details>
        ))}
      </div>
      <details className="demo-provenance">
        <summary>What is demo data?</summary>
        <p>
          Example company reports, usage history and review records are synthetic and carry an
          example banner. The interactive emissions simulator below uses a 50 mg/Nm³ one-hour
          illustrative threshold and invented readings. These are not statutory limits or
          measurements. Live city cards continue to use actual cached provider responses. The
          satellite orbit and scan beam are illustrations, not live spacecraft tracking.
        </p>
      </details>
    </section>
  );
}
export function MetroComparison({ cities }: { cities: Item[] }) {
  const [metric, setMetric] = useState('pm25');
  const values: Item[] = cities.map((c) => ({ ...c, value: c.model?.air?.[metric] })),
    max = Math.max(1, ...values.map((c) => (typeof c.value === 'number' ? c.value : 0)));
  return (
    <section className="metro-comparison panel">
      <div className="row-between">
        <div>
          <span className="eyebrow">REGIONAL AIR QUALITY · MODEL OUTPUT</span>
          <h2>Eight cities. One clear comparison.</h2>
        </div>
        <label className="compact-field">
          Pollutant
          <select
            aria-label="Comparison pollutant"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="pm25">PM₂.₅</option>
            <option value="pm10">PM₁₀</option>
          </select>
        </label>
      </div>
      <div className="metro-bars">
        {values.map((c) => (
          <div className="metro-bar-row" key={c.id}>
            <span>{c.name}</span>
            <div>
              <i
                style={{
                  width:
                    typeof c.value === 'number' ? Math.max(2, (c.value / max) * 100) + '%' : '0%',
                }}
              />
            </div>
            <strong>
              {number(c.value, 1)} <small>µg/m³</small>
            </strong>
          </div>
        ))}
      </div>
      <p className="chart-note">
        Current cached estimates at city coordinates. Bar lengths compare this view only; colours do
        not indicate an official AQI category. Source times and station availability are on the city
        cards.
      </p>
    </section>
  );
}
export function VerificationStudio({
  cities = [],
  facility,
  atmosphere,
  satellite,
  rules = [],
}: {
  cities?: Item[];
  facility?: Item;
  atmosphere?: Item;
  satellite?: Item;
  rules?: Item[];
}) {
  const [selected, setSelected] = useState('hyderabad'),
    [mode, setMode] = useState<'provider' | 'demo'>('provider'),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [scanning, setScanning] = useState(true),
    [emission, setEmission] = useState(demo.value);
  const city = cities.find((c) => c.id === selected) || cities[0],
    synthetic = mode === 'demo';
  const site = synthetic
    ? { name: demo.site, latitude: demo.latitude, longitude: demo.longitude }
    : facility || city;
  const air = facility
    ? atmosphere?.payload?.sources?.find((s: Item) => s.kind === 'air_quality')
    : null;
  const pm = synthetic ? demo.pm25 : facility ? air?.data?.current?.pm2_5 : city?.model?.air?.pm25;
  const stamp = facility ? atmosphere?.created_at : city?.model?.retrievedAt;
  const coordsValid =
    site &&
    Number.isFinite(site.latitude) &&
    Math.abs(site.latitude) <= 90 &&
    Number.isFinite(site.longitude) &&
    Math.abs(site.longitude) <= 180;
  const realRule = rules.find((r: Item) => r.facility_id === facility?.id && r.active);
  const imageryAvailable = synthetic || satellite?.status === 'available';
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step >= 4) setPlaying(false);
      else setStep((s) => s + 1);
    }, 2200);
    return () => clearTimeout(t);
  }, [step, playing]);
  function chooseMode(next: 'provider' | 'demo') {
    setMode(next);
    setStep(0);
    setPlaying(false);
  }
  const facts = [
    {
      title: coordsValid
        ? 'Coordinates matched to the selected location'
        : 'Select a location to begin',
      status: coordsValid ? 'Location selected' : 'Waiting for location',
      text: coordsValid
        ? String(site.latitude.toFixed(4)) +
          ', ' +
          String(site.longitude.toFixed(4)) +
          ' · ' +
          site.name
        : 'No position is inferred from your device.',
      detail: synthetic
        ? 'Illustrative site and public Hyderabad coordinates.'
        : facility
          ? 'Coordinates and reporting boundary come from the company facility record.'
          : 'Public city coordinates determine the regional model grid. This is not an exact monitoring-station position.',
    },
    {
      title: pm != null ? 'Atmospheric context received' : 'Air-quality source not available',
      status: synthetic ? 'Demo value' : pm != null ? 'Provider result' : 'No result',
      text: pm != null ? 'PM₂.₅ ' + number(pm, 1) + ' µg/m³' : 'No concentration is substituted.',
      detail: synthetic
        ? 'Invented concentration for the walkthrough.'
        : pm != null
          ? 'Open-Meteo / CAMS model output. Retrieved ' +
            date(stamp) +
            '. Regional conditions cannot identify a company violation.'
          : 'Load site context or wait for the city background fetch. Missing providers stay unavailable.',
    },
    {
      title: imageryAvailable
        ? 'Compare two satellite observation windows'
        : 'Satellite comparison needs a site request',
      status: synthetic
        ? 'Simulated scan'
        : imageryAvailable
          ? 'Dated imagery'
          : 'Not requested here',
      text: synthetic
        ? 'NDVI ' + demo.ndviBefore.toFixed(2) + ' → ' + demo.ndviAfter.toFixed(2)
        : imageryAvailable
          ? 'NDVI ' +
            number(satellite?.payload?.before?.meanNDVI, 3) +
            ' → ' +
            number(satellite?.payload?.after?.meanNDVI, 3)
          : 'Sentinel-2 · vegetation and water context',
      detail: synthetic
        ? 'The scan, land pattern and index change are synthetic.'
        : imageryAvailable
          ? 'Actual selected scene dates: ' +
            String(satellite?.payload?.before?.date || '').slice(0, 10) +
            ' and ' +
            String(satellite?.payload?.after?.date || '').slice(0, 10) +
            '.'
          : 'Company users select a facility and dates in Site verification. This animation is an illustration, not satellite evidence.',
    },
    {
      title: synthetic
        ? emission > demo.threshold
          ? 'A configured threshold needs follow-up'
          : 'Observation within the demo threshold'
        : realRule
          ? 'Inspect the facility assessment'
          : 'Factory emissions are a separate evidence stream',
      status: synthetic
        ? 'Demo comparison'
        : realRule
          ? String(realRule.assessment?.status || 'not_assessed').replaceAll('_', ' ')
          : 'Not assessed',
      text: synthetic
        ? emission + ' ' + demo.unit + ' / illustrative limit ' + demo.threshold
        : realRule
          ? realRule.assessment?.reason
          : 'No connected continuous factory feed',
      detail: synthetic
        ? 'Matching metric, dry normalised basis and a complete one-hour period. This is an operational demonstration, not a legal finding.'
        : 'A real comparison needs the facility reading, correct unit, basis, reporting period, quality and applicable reference. Ambient pollution is never substituted.',
    },
    {
      title: synthetic
        ? 'A reviewer sees the evidence and next step'
        : 'Keep the decision accountable',
      status: synthetic ? 'Demo handoff' : 'Human review',
      text: synthetic
        ? emission > demo.threshold
          ? 'Preview: request supporting facility evidence'
          : 'Preview: continue monitoring'
        : 'Sources → comparison → recorded reviewer decision',
      detail: synthetic
        ? 'No notification, case, licence change or email is created by this simulation.'
        : 'Actual threshold and review events appear in authenticated company and government inboxes. AI explanations require a configured local model.',
    },
  ];
  const fact = facts[step];
  return (
    <section
      className={'verification-studio ' + (synthetic ? 'demo-mode' : '')}
      aria-label="Visual verification studio"
    >
      <div className="studio-heading">
        <div>
          <span className="eyebrow">VERIFICATION STUDIO</span>
          <h2>See how a location becomes evidence.</h2>
          <p>Follow the checks, inspect the source, understand the next step.</p>
        </div>
        <div className="studio-mode" role="group" aria-label="Verification data mode">
          <button className={!synthetic ? 'selected' : ''} onClick={() => chooseMode('provider')}>
            Provider data
          </button>
          <button className={synthetic ? 'selected' : ''} onClick={() => chooseMode('demo')}>
            Demo simulation
          </button>
        </div>
      </div>
      <div className="studio-provenance">
        <Database size={15} />
        {synthetic
          ? demo.note
          : 'Replaying the latest stored results. Animation does not issue provider requests or imply a check succeeded.'}
      </div>
      <div className="studio-layout">
        <div className={'studio-visual stage-' + step}>
          <SatelliteScene scanning={scanning && (!playing || step === 2)} />
          <div className="coordinate-lock">
            <MapPin size={16} />
            <div>
              <strong>{site?.name || 'Select a location'}</strong>
              <span>
                {coordsValid
                  ? Math.abs(site.latitude).toFixed(4) +
                    (site.latitude < 0 ? '° S · ' : '° N · ') +
                    Math.abs(site.longitude).toFixed(4) +
                    (site.longitude < 0 ? '° W' : '° E')
                  : 'Coordinates unavailable'}
              </span>
            </div>
            <span className="target-crosshair" />
          </div>
          <div className="scan-raster" />
          <div className="studio-readout">
            <span>{synthetic ? 'DEMO ATMOSPHERIC CONTEXT' : 'MODELLED ATMOSPHERIC CONTEXT'}</span>
            <strong>
              {number(pm, 1)} <small>µg/m³ PM₂.₅</small>
            </strong>
            <small>
              {synthetic
                ? 'Invented value'
                : stamp
                  ? 'Retrieved ' + date(stamp)
                  : 'Waiting for a source result'}
            </small>
          </div>
          <button className="scan-control" onClick={() => setScanning((s) => !s)}>
            {scanning ? <Pause size={14} /> : <Play size={14} />}{' '}
            {scanning ? 'Pause scan effect' : 'Play scan effect'}
          </button>
        </div>
        <div className="studio-inspector">
          {!facility && !synthetic && (
            <label className="studio-city">
              Location
              <select
                aria-label="Verification city"
                value={city?.id || ''}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setStep(0);
                  setPlaying(false);
                }}
              >
                {cities.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="studio-step-number">CHECK 0{step + 1} / 05</span>
          <span className="source-chip">{fact.status}</span>
          <h3>{fact.title}</h3>
          <strong className="studio-result">{fact.text}</strong>
          <p>{fact.detail}</p>
          {synthetic && step === 3 && (
            <div className="emission-control">
              <label htmlFor="demo-emission">
                Simulated stack particulate matter{' '}
                <b>
                  {emission} {demo.unit}
                </b>
              </label>
              <input
                id="demo-emission"
                aria-label="Simulated stack particulate matter"
                type="range"
                min="0"
                max="100"
                value={emission}
                onChange={(e) => setEmission(Number(e.target.value))}
              />
              <div className="emission-gauge">
                <i
                  style={{
                    width: emission + '%',
                    background: emission > demo.threshold ? '#d99364' : '#a8dca3',
                  }}
                />
                <span style={{ left: demo.threshold + '%' }} />
              </div>
              <small>Illustrative threshold: 50 mg/Nm³ · 60 minutes · dry normalised</small>
              <div className="scenario-presets">
                <button onClick={() => setEmission(30)}>Within threshold</button>
                <button onClick={() => setEmission(75)}>Above threshold</button>
              </div>
            </div>
          )}
          <div className="studio-playback">
            <button
              className="button primary"
              onClick={() => {
                if (step === 4) setStep(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}{' '}
              {playing ? 'Pause replay' : 'Replay verification'}
            </button>
            <button
              className="icon-button"
              aria-label="Reset verification replay"
              onClick={() => {
                setStep(0);
                setPlaying(false);
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="verification-steps" aria-label="Verification stages">
        {stages.map(([title, Icon], i) => (
          <button
            key={title}
            className={step === i ? 'active' : step > i ? 'visited' : ''}
            onClick={() => {
              setStep(i);
              setPlaying(false);
            }}
            aria-pressed={step === i}
          >
            <span>{step > i ? <Check size={17} /> : <Icon size={17} />}</span>
            <b>{title}</b>
            {i < 4 && <ArrowRight size={13} />}
          </button>
        ))}
      </div>
    </section>
  );
}
