import React, { useEffect, useState } from 'react';
import {
  FileText,
  ScanSearch,
  BookOpen,
  Satellite,
  CloudSun,
  ShieldCheck,
  Play,
  Pause,
  ArrowRight,
  ArrowLeft,
  Check,
  Radio,
  Leaf,
} from 'lucide-react';
import { number, type Item } from './api';
const steps = [
  {
    title: 'A company makes a claim',
    short: 'Submit',
    icon: FileText,
    text: 'A company uploads its sustainability report and tells us which site and reporting year it covers.',
    outcome: 'A report enters the company’s evidence library.',
  },
  {
    title: 'Find the supporting evidence',
    short: 'Read',
    icon: ScanSearch,
    text: 'The report is organised into readable passages. Every extracted claim keeps a link back to its source.',
    outcome: 'The reviewer can open the original context.',
  },
  {
    title: 'Compare the right records',
    short: 'Compare',
    icon: BookOpen,
    text: 'Water and energy records are compared only when the units, years and reporting boundary match.',
    outcome: 'Missing evidence stays visible. It is never filled with a guess.',
  },
  {
    title: 'Look at the wider environment',
    short: 'Observe',
    icon: Satellite,
    text: 'Satellite observations add a before-and-after view. Regional air-quality readings provide another piece of context.',
    outcome: 'Environmental context supports a closer review; it does not prove a claim.',
  },
  {
    title: 'A person makes the decision',
    short: 'Review',
    icon: ShieldCheck,
    text: 'Government Oversight inspects submissions, asks for evidence and records actions with a reason.',
    outcome: 'A recorded decision and a clear public status.',
  },
];
export function SatelliteScene({ scanning = true }: { scanning?: boolean }) {
  return (
    <div className={'satellite-scene ' + (scanning ? 'scanning' : '')} aria-hidden="true">
      <div className="scene-stars" />
      <div className="planet-halo" />
      <svg viewBox="0 0 640 340">
        <defs>
          <radialGradient id="planet">
            <stop offset="0" stopColor="#386e5a" />
            <stop offset="1" stopColor="#153e35" />
          </radialGradient>
          <clipPath id="earthClip">
            <ellipse cx="320" cy="245" rx="238" ry="158" />
          </clipPath>
          <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#d6eea8" stopOpacity=".5" />
            <stop offset="1" stopColor="#d6eea8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="320" cy="245" rx="238" ry="158" fill="url(#planet)" stroke="#56846d" />
        <g clipPath="url(#earthClip)" className="planet-grid">
          <path
            d="M80 195H560M80 245H560M80 295H560M320 80V405M220 90Q150 240 220 395M420 90Q490 240 420 395M120 145Q320 245 520 145M110 330Q320 230 530 330"
            fill="none"
            stroke="#7da584"
            strokeOpacity=".25"
          />
          <path
            d="M170 140L240 116 283 155 265 194 302 230 270 252 226 228 192 245 169 209 130 192Z M365 150L417 131 474 178 441 216 390 206 369 258 337 224Z M310 288L357 269 392 300 374 341 331 333Z"
            fill="#678957"
            opacity=".62"
          />
          <path d="M235 215L300 202 347 230 330 269 275 275 231 247Z" fill="#8ba967" opacity=".7" />
        </g>
        <ellipse
          cx="320"
          cy="210"
          rx="303"
          ry="100"
          fill="none"
          stroke="#bfd89d"
          strokeDasharray="4 8"
          strokeOpacity=".45"
          transform="rotate(-16 320 210)"
        />
        <g className="orbit-satellite">
          <path d="M323 76L288 242 378 244Z" fill="url(#beam)" />
          <rect x="303" y="58" width="36" height="24" rx="4" fill="#e8f2d5" />
          <path
            d="M283 50L300 54 292 83 275 79ZM344 57L362 62 354 90 337 85Z"
            fill="#91bed0"
            stroke="#d6e8df"
          />
          <path d="M320 58V45M315 44H326" stroke="#e8f2d5" strokeWidth="2" />
        </g>
        <circle
          className="site-pulse"
          cx="288"
          cy="241"
          r="23"
          fill="none"
          stroke="#d6eea8"
          strokeWidth="2"
        />
        <circle cx="288" cy="241" r="5" fill="#e3f4b3" />
      </svg>
      <div className="scene-label">
        <Satellite size={14} /> Satellite observation
      </div>
      <div className="scene-coordinate">
        <span /> Selected site · illustrative view
      </div>
    </div>
  );
}
export function AirScene({
  value = null,
  illustrative = false,
}: {
  value?: number | null;
  illustrative?: boolean;
}) {
  return (
    <div className="air-scene" aria-hidden="true">
      <div className="air-orb">
        <CloudSun size={48} />
        <div className="air-ring r1" />
        <div className="air-ring r2" />
      </div>
      {Array.from(
        { length: illustrative ? Math.max(4, Math.min(40, Math.round((value ?? 0) / 3))) : 14 },
        (_, i) => (
          <span
            key={i}
            className="air-particle"
            style={{
              left: ((i * 47) % 95) + '%',
              top: ((i * 29) % 80) + '%',
              animationDelay: i * 0.33 + 's',
            }}
          />
        ),
      )}
      <div className="air-value">
        <span>PM₂.₅</span>
        <strong>
          {value == null ? '—' : number(value, 1)}
          <small> μg/m³</small>
        </strong>
        <p>
          {illustrative
            ? 'Simulated concentration · not a measurement'
            : value == null
              ? 'Awaiting a recorded provider result'
              : 'Latest stored provider observation'}
        </p>
      </div>
    </div>
  );
}
export function ReviewJourney({ compact = false }: { compact?: boolean }) {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 5000);
    return () => clearTimeout(t);
  }, [step, playing]);
  const item = steps[step],
    Icon = item.icon;
  return (
    <section className={'review-journey ' + (compact ? 'journey-compact' : '')}>
      <div className="journey-top">
        <span className="eyebrow">FROM A CLAIM TO A CLEAR DECISION</span>
        <span className="illustration-label">Illustrated walkthrough · no records changed</span>
      </div>
      <div className="journey-layout">
        <div className="journey-explanation">
          <span className="journey-counter">
            0{step + 1} <span>/ 05</span>
          </span>
          <h2>{item.title}</h2>
          <p>{item.text}</p>
          <div className="journey-outcome">
            <Check size={16} />
            {item.outcome}
          </div>
          <div className="journey-controls">
            <button
              className="icon-button"
              aria-label="Previous step"
              disabled={step === 0}
              onClick={() => {
                setPlaying(false);
                setStep(step - 1);
              }}
            >
              <ArrowLeft size={17} />
            </button>
            <button
              className="button primary"
              onClick={() => {
                if (step === 4) setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}{' '}
              {playing ? 'Pause walkthrough' : 'Play walkthrough'}
            </button>
            <button
              className="icon-button"
              aria-label="Next step"
              disabled={step === 4}
              onClick={() => {
                setPlaying(false);
                setStep(step + 1);
              }}
            >
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
        <div className="journey-stage" key={step}>
          {step === 3 ? (
            <SatelliteScene />
          ) : (
            <>
              <div className="journey-orbits">
                <span />
                <span />
                <span />
              </div>
              <div className="journey-core">
                <Icon size={48} />
              </div>
              <div className="floating-proof proof-a">
                <FileText size={17} />
                <span>
                  Source report<small>Original context</small>
                </span>
                <Check size={13} />
              </div>
              <div className="floating-proof proof-b">
                <BookOpen size={17} />
                <span>
                  Evidence trail<small>Years · units · scope</small>
                </span>
              </div>
              <div className="floating-proof proof-c">
                <ShieldCheck size={17} />
                <span>
                  Human judgment<small>Recorded rationale</small>
                </span>
              </div>
              <span className="journey-data-path" />
              <span className="journey-dot dot-one" />
              <span className="journey-dot dot-two" />
            </>
          )}
        </div>
      </div>
      <div className="journey-steps" role="tablist" aria-label="Review walkthrough steps">
        {steps.map((s, i) => {
          const I = s.icon;
          return (
            <button
              key={s.short}
              role="tab"
              aria-selected={step === i}
              onClick={() => {
                setPlaying(false);
                setStep(i);
              }}
              className={step === i ? 'selected' : step > i ? 'completed' : ''}
            >
              <span>{step > i ? <Check size={14} /> : <I size={16} />}</span>
              <b>0{i + 1}</b>
              {s.short}
            </button>
          );
        })}
      </div>
    </section>
  );
}
export function ReviewExperience() {
  const [tab, setTab] = useState('journey'),
    [particles, setParticles] = useState(18),
    [scan, setScan] = useState(false);
  return (
    <div className="review-experience">
      <div className="scene-tabs" role="tablist" aria-label="Visual explanation">
        <button role="tab" aria-selected={tab === 'journey'} onClick={() => setTab('journey')}>
          Claim to decision
        </button>
        <button role="tab" aria-selected={tab === 'satellite'} onClick={() => setTab('satellite')}>
          <Satellite size={15} />
          Satellite view
        </button>
        <button role="tab" aria-selected={tab === 'air'} onClick={() => setTab('air')}>
          <CloudSun size={15} />
          Air quality
        </button>
      </div>
      {tab === 'journey' ? (
        <ReviewJourney />
      ) : tab === 'satellite' ? (
        <div className="scene-explanation">
          <div>
            <span className="illustration-label">Presentation simulation · no data request</span>
            <h2>A wider view of a selected site.</h2>
            <p>
              A satellite observation offers a different perspective on vegetation and surface
              water. Comparing dates can show change that a reviewer may want to investigate.
            </p>
            <p>
              The moving beam below is an illustration. Actual observation dates and measured image
              indices are shown in the Environment page.
            </p>
            <button className="button primary" onClick={() => setScan(!scan)}>
              {scan ? <Pause size={15} /> : <Play size={15} />}{' '}
              {scan ? 'Pause scan illustration' : 'Animate observation scan'}
            </button>
          </div>
          <SatelliteScene scanning={scan} />
        </div>
      ) : (
        <div className="scene-explanation">
          <div>
            <span className="illustration-label">Air-quality simulation · invented value</span>
            <h2>Make invisible particles visible.</h2>
            <p>
              Move the slider to see an illustrative particle concentration. A real provider
              observation has its own location, measurement time and availability.
            </p>
            <label className="field">
              <span>Simulated particle concentration</span>
              <input
                aria-label="Simulated particle concentration"
                type="range"
                min={5}
                max={100}
                value={particles}
                onChange={(e) => setParticles(Number(e.target.value))}
              />
            </label>
            <p className="fine-print">
              This control changes the illustration only. It does not change a company record, a
              public reading or a government decision.
            </p>
          </div>
          <AirScene value={particles} illustrative />
        </div>
      )}
    </div>
  );
}
