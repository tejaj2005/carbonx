import React, { useState, useEffect } from 'react';
import { Satellite, ArrowUpRight } from 'lucide-react';
import { SatelliteScene } from './VisualJourney';
import { worldLandPath } from './data/world-land';
import { api, number, date, type Item } from './api';
import { Panel, Badge } from './components';
function OrbitTracking({
  facility,
  publicView = false,
}: {
  facility?: Item;
  publicView?: boolean;
}) {
  const [position, setPosition] = useState<Item | null>(null),
    [failed, setFailed] = useState(false),
    [paused, setPaused] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const p = await api(
          publicView ? '/public/satellite/position' : '/environment/satellite/position',
        );
        if (active) {
          setPosition(p);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [publicView]);
  return (
    <section
      className={'satellite-tracker ' + (paused ? 'animation-paused' : '')}
      aria-label="Live ISS orbital coordinates"
    >
      <div className="orbit-animation">
        <SatelliteScene />
        <button className="orbit-pause" onClick={() => setPaused(!paused)} aria-pressed={paused}>
          {paused ? 'Resume animation' : 'Pause animation'}
        </button>
      </div>
      <figure className="orbit-map">
        <svg
          viewBox="0 0 360 180"
          role="img"
          aria-label="Geolocation map showing the selected facility and latest ISS position"
        >
          <rect width="360" height="180" fill="#e9f1ed" />
          <path
            d="M0 90H360M0 45H360M0 135H360M90 0V180M180 0V180M270 0V180"
            fill="none"
            stroke="#cadaD1"
            strokeWidth=".6"
          />
          <path
            d={worldLandPath}
            fill="#a5bda9"
            fillRule="evenodd"
            stroke="#7c9d87"
            strokeWidth=".3"
          />
          {facility && (
            <g
              transform={
                'translate(' + (facility.longitude + 180) + ',' + (90 - facility.latitude) + ')'
              }
            >
              <circle r="3.5" fill="#165b41" stroke="white" strokeWidth="1.3" />
              <title>
                {facility.name +
                  ' · ' +
                  facility.latitude.toFixed(4) +
                  ', ' +
                  facility.longitude.toFixed(4)}
              </title>
            </g>
          )}
          {position && (
            <g
              transform={
                'translate(' + (position.longitude + 180) + ',' + (90 - position.latitude) + ')'
              }
            >
              <circle
                className="geo-iss-pulse"
                r="6"
                fill="none"
                stroke="#b26c13"
                strokeWidth="1"
              />
              <circle r="3" fill="#e4a02c" stroke="#fff" strokeWidth="1.2" />
              <title>
                {'ISS · ' + position.latitude.toFixed(4) + ', ' + position.longitude.toFixed(4)}
              </title>
            </g>
          )}
        </svg>
        <figcaption>
          {facility && <span className="geo-legend-site">● Selected facility</span>}
          <span className="geo-legend-iss">
            ● {failed || position?.status === 'stale' ? 'Last known ISS' : 'ISS position'}
          </span>
        </figcaption>
      </figure>
      {facility && (
        <p className="facility-geolocation">
          <b>{facility.name}</b>
          <br />
          {facility.latitude.toFixed(4)}° latitude · {facility.longitude.toFixed(4)}° longitude{' '}
          <small>Saved company site · Natural Earth basemap</small>
        </p>
      )}
      <div className="row-between">
        <h3>Live ISS coordinates</h3>
        <Badge
          value={
            failed || position?.status === 'stale' ? 'stale' : position ? 'available' : 'loading'
          }
        />
      </div>
      {position ? (
        <>
          <div className="orbit-coordinate-grid">
            <div>
              <small>Latitude</small>
              <strong>{number(position.latitude, 4)}°</strong>
            </div>
            <div>
              <small>Longitude</small>
              <strong>{number(position.longitude, 4)}°</strong>
            </div>
            <div>
              <small>Altitude</small>
              <strong>{number(position.altitudeKm, 1)} km</strong>
            </div>
            <div>
              <small>Position time</small>
              <strong>{new Date(position.observedAt).toLocaleTimeString()}</strong>
            </div>
          </div>
          <small className="muted">
            {failed
              ? 'Last known position · connection interrupted'
              : 'Coordinates refresh every 15 seconds'}{' '}
            · {date(position.observedAt)}
          </small>
        </>
      ) : (
        <p className="muted">
          {failed
            ? 'Position feed unavailable. Retrying automatically.'
            : 'Connecting to the orbital position feed…'}
        </p>
      )}
      <p className="orbit-source-note">
        Animation illustrates satellite observation. ISS coordinates come from{' '}
        <a href="https://wheretheiss.at/w/developer" target="_blank" rel="noreferrer">
          Where the ISS at?
        </a>
        ; the India image comes from Meteosat. The ISS feed does not validate a company location.
      </p>
    </section>
  );
}
export function SatelliteVerification({
  facility,
  publicView = false,
}: {
  facility?: Item;
  publicView?: boolean;
}) {
  const [frame, setFrame] = useState<Item | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError('');
    try {
      setFrame(await api(publicView ? '/public/satellite/live' : '/environment/satellite/live'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Panel
      title="Latest satellite view · India"
      kicker="EUMETSAT IMAGERY · LIVE ISS TRACKING"
      action={
        <button className="button secondary" disabled={loading} onClick={() => void load()}>
          <Satellite size={16} />
          {loading ? 'Loading…' : 'Refresh image'}
        </button>
      }
    >
      {error && (
        <p role="alert" className="error-text">
          {error}
          {frame && ' Showing the previous image.'}
        </p>
      )}
      {frame ? (
        <div className="live-satellite-layout">
          <figure>
            <img
              src={frame.imageUrl}
              alt="Meteosat infrared cloud and weather imagery over India, longitude 67–98°E and latitude 6–37°N"
              onError={() => setError('Satellite image could not be loaded. Refresh to retry.')}
            />
            <figcaption>© EUMETSAT · SEVIRI infrared · India regional view</figcaption>
          </figure>
          <div>
            <OrbitTracking facility={facility} publicView={publicView} />
            <Badge value={error ? 'stale' : frame.status} />
            <h3>Clouds and weather from orbit</h3>
            <p>{frame.instrument}</p>
            <dl>
              <dt>Captured</dt>
              <dd>{date(frame.observedAt)}</dd>
              <dt>Image age at refresh</dt>
              <dd>{frame.ageMinutes} minutes</dd>
              <dt>Source interval</dt>
              <dd>{frame.intervalMinutes} minutes</dd>
              <dt>Retrieved</dt>
              <dd>{date(frame.retrievedAt)}</dd>
            </dl>
            <p className="chart-note">{frame.interpretation}</p>
            <a className="text-link" href={frame.source} target="_blank" rel="noreferrer">
              EUMETSAT source <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      ) : (
        <>
          <OrbitTracking facility={facility} publicView={publicView} />
          <p className="muted">
            {loading
              ? 'Fetching the latest available satellite frame…'
              : 'No image available. Refresh to retry.'}
          </p>
        </>
      )}
    </Panel>
  );
}
