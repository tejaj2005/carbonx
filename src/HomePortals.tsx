import React, { useEffect, useState } from 'react';
import { Globe2, Building2, Landmark, ArrowRight } from 'lucide-react';
import { useWorkspace } from './context';
import { api, mutate } from './api';
import { rememberDestination, type Portal } from './role-routing';
export function HomePortals() {
  const { user, signIn, toast } = useWorkspace(),
    [demo, setDemo] = useState(false),
    [busy, setBusy] = useState<Portal | null>(null);
  useEffect(() => {
    api('/public/config')
      .then((c) => setDemo(c.allowDemo))
      .catch(() => {});
  }, []);
  function enter(portal: Portal, page: string) {
    if (user?.portal === portal) {
      location.hash = page;
      return;
    }
    rememberDestination(portal, page);
    location.hash = portal + '-login';
  }
  async function quick(portal: Portal) {
    setBusy(portal);
    try {
      const result = await mutate(user?.isExample ? '/auth/demo-switch' : '/auth/demo', { portal });
      signIn(result);
      location.hash = portal === 'government' ? 'government' : 'overview';
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  function scroll(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
  return (
    <section className="home-portals" aria-label="Choose your CarbonX portal">
      <article>
        <Globe2 size={24} />
        <h2>Public view</h2>
        <p>
          Follow published company claims and real environmental observations. Open to everyone.
        </p>
        <button className="button primary" onClick={() => scroll('public-registry')}>
          Explore public records <ArrowRight size={15} />
        </button>
        <div className="home-portal-links">
          <button onClick={() => scroll('home-air-quality')}>Live air quality & city graphs</button>
          <button onClick={() => scroll('home-satellite')}>
            Satellite imagery & live coordinates
          </button>
        </div>
        <small>No account required.</small>
      </article>
      <article>
        <Building2 size={24} />
        <h2>Company portal</h2>
        <p>Upload evidence, submit claims and track emissions, reviews and notifications.</p>
        <button className="button primary" onClick={() => enter('company', 'overview')}>
          {user?.portal === 'company' ? 'Open company workspace' : 'Company login'}{' '}
          <ArrowRight size={15} />
        </button>
        <div className="home-portal-links">
          {[
            ['reports', 'Reports & uploads'],
            ['submissions', 'Claims & submissions'],
            ['environment', 'Satellite & site verification'],
            ['monitoring', 'Emissions & air quality'],
            ['settings', 'Profile & team settings'],
          ].map(([page, title]) => (
            <button key={page} onClick={() => enter('company', page)}>
              {title}
            </button>
          ))}
        </div>
        {demo && (
          <button
            className="button secondary"
            disabled={busy !== null}
            onClick={() => void quick('company')}
          >
            {busy === 'company' ? 'Signing in…' : 'Company demo login'}
          </button>
        )}
      </article>
      <article>
        <Landmark size={24} />
        <h2>Government Oversight</h2>
        <p>
          Review company claims, inspect facilities, monitor alerts and export oversight reports.
        </p>
        <button className="button primary" onClick={() => enter('government', 'government')}>
          {user?.portal === 'government' ? 'Open government workspace' : 'Government login'}{' '}
          <ArrowRight size={15} />
        </button>
        <div className="home-portal-links">
          {[
            ['gov-registry', 'Company & licence registry'],
            ['gov-submissions', 'Claim reviews & actions'],
            ['gov-monitoring', 'Emissions, air & satellite verification'],
            ['gov-users', 'Users & permissions'],
          ].map(([page, title]) => (
            <button key={page} onClick={() => enter('government', page)}>
              {title}
            </button>
          ))}
        </div>
        {demo && (
          <button
            className="button secondary"
            disabled={busy !== null}
            onClick={() => void quick('government')}
          >
            {busy === 'government' ? 'Signing in…' : 'Government demo login'}
          </button>
        )}
      </article>
      {demo && (
        <p className="home-demo-note">
          Demo logins open an isolated synthetic company workspace. Environmental feeds retain their
          real provider readings and timestamps.
        </p>
      )}
    </section>
  );
}
