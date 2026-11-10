import { takeDestination } from './role-routing';
import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  LayoutDashboard,
  FileText,
  ScanSearch,
  BookOpen,
  Database,
  Earth,
  ClipboardCheck,
  FlaskConical,
  Activity,
  Settings,
  LogOut,
  Menu,
  ArrowRight,
  ShieldCheck,
  Leaf,
  RefreshCw,
} from 'lucide-react';
import { api, mutate } from './api';
import { WorkspaceProvider, useWorkspace } from './context';
import { Brand, Spinner, Modal, NotificationBell } from './components';
const MonitoringPage = lazy(() =>
  import('./Monitoring').then((m) => ({ default: m.MonitoringPage })),
);
const PublicIndia = lazy(() => import('./Monitoring').then((m) => ({ default: m.PublicIndia })));
import { PublicPortal, PortalLogin } from './Portals';
const GovernmentPortal = lazy(() =>
  import('./pages/GovernmentPortal').then((m) => ({ default: m.GovernmentPortal })),
);
const CompanyPortal = lazy(() =>
  import('./pages/CompanyPortal').then((m) => ({ default: m.CompanyPortal })),
);
const Dashboard = lazy(() => import('./pages/Workspace').then((m) => ({ default: m.Dashboard })));
const Reports = lazy(() => import('./pages/Workspace').then((m) => ({ default: m.Reports })));
const Claims = lazy(() => import('./pages/Workspace').then((m) => ({ default: m.Claims })));
const Evidence = lazy(() => import('./pages/Evidence').then((m) => ({ default: m.Evidence })));
const History = lazy(() => import('./pages/Evidence').then((m) => ({ default: m.History })));
const Environment = lazy(() =>
  import('./pages/Evidence').then((m) => ({ default: m.Environment })),
);
const Recommendations = lazy(() =>
  import('./pages/Review').then((m) => ({ default: m.Recommendations })),
);
const Evaluation = lazy(() => import('./pages/Review').then((m) => ({ default: m.Evaluation })));
const Audit = lazy(() => import('./pages/Review').then((m) => ({ default: m.Audit })));
const SettingsPage = lazy(() =>
  import('./pages/Review').then((m) => ({ default: m.SettingsPage })),
);
const ClaimDetail = lazy(() => import('./ClaimDetail').then((m) => ({ default: m.ClaimDetail })));
import './styles.css';
import './portals.css';
import { companySections } from './navigation';
import { SectionTabs } from './components';
const navigation = [
  ['overview', 'Overview', LayoutDashboard],
  ['reports', 'Reports', FileText],
  ['monitoring', 'Monitoring', Activity],
  ['submissions', 'Submissions', ShieldCheck],
  ['history', 'History', Database],
  ['settings', 'Settings', Settings],
] as const;
function Shell() {
  const { user, ready, loading, data, refresh, logout, claimId, signIn, toast } = useWorkspace();
  const [view, setView] = useState(location.hash.slice(1) || 'home'),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const change = () => {
      setView(location.hash.slice(1) || 'public');
      setMenu(false);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  async function switchDemo() {
    try {
      signIn(await mutate('/auth/demo-switch', { portal: 'government' }));
      location.hash = 'government';
    } catch (e) {
      toast((e as Error).message);
    }
  }
  useEffect(() => {
    if (!ready || !user) return;
    const target =
      view === 'government-login' ? 'government' : view === 'company-login' ? 'company' : null;
    if (target === user.portal) location.hash = takeDestination(target);
  }, [ready, user, view]);
  if (!ready) return <Spinner />;
  if (view === 'public' || view === 'home') return <PublicPortal />;
  if (view === 'india')
    return (
      <Suspense fallback={<Spinner />}>
        <PublicIndia />
      </Suspense>
    );
  if (view === 'government-login' || view === 'company-login')
    return (
      <PortalLogin key={view} portal={view === 'government-login' ? 'government' : 'company'} />
    );
  if (!user)
    return (
      <PortalLogin
        portal={view === 'government' || view.startsWith('gov-') ? 'government' : 'company'}
      />
    );
  if (user.portal === 'government')
    return (
      <Suspense fallback={<Spinner />}>
        <GovernmentPortal view={view} />
      </Suspense>
    );
  const pages: Record<string, React.ReactNode> = {
    overview: <Dashboard />,
    submissions: <CompanyPortal />,
    reports: <Reports />,
    claims: <Claims />,
    evidence: <Evidence />,
    history: <History />,
    environment: <Environment />,
    monitoring: <MonitoringPage />,
    recommendations: <Recommendations />,
    evaluations: <Evaluation />,
    audit: <Audit />,
    settings: <SettingsPage />,
  };
  const section =
    companySections.find((s) => s.pages.some((p) => p[0] === view)) || companySections[0];
  const current = section.title;
  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (menu ? 'sidebar-open' : '')}>
        <a href="#overview" className="brand-link">
          <Brand />
        </a>
        <div className="workspace-name">
          <span>{user.company.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.company}</strong>
            <small>{user.isExample ? 'Example workspace' : 'Company workspace'}</small>
          </div>
        </div>
        <span className="nav-label">INTELLIGENCE WORKSPACE</span>
        <nav>
          {navigation.map(([id, name, Icon]) => (
            <a
              href={'#' + id}
              onClick={() => setMenu(false)}
              className={section.id === id ? 'active' : ''}
              aria-current={section.id === id ? 'page' : undefined}
              key={id}
            >
              <Icon size={18} />
              {name}
              {id === 'reports' && data.dashboard.stats.needsReview > 0 && (
                <b>{data.dashboard.stats.needsReview}</b>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a href="#home" className="government-public-link">
            <Earth size={16} />
            Public transparency
            <ArrowRight size={14} />
          </a>
          <div className="workspace-health">
            <span />
            <strong>
              {data.settings.providers.hostedAI?.configured
                ? 'AI configured'
                : 'Evidence review ready'}
            </strong>
            <small>
              {data.settings.providers.hostedAI?.configured
                ? 'Evidence remains traceable'
                : 'Source-linked review workspace'}
            </small>
          </div>
          <div className="user">
            <span>{user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            <button onClick={logout} title="Sign out" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {menu && <div className="nav-scrim" onClick={() => setMenu(false)} />}
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span> <strong>{current}</strong>
          </span>
          <div className="topbar-actions">
            <NotificationBell />
            <span className="local-badge">
              <span />
              Workspace online
            </span>
            <button
              className="icon-button"
              onClick={() => void refresh()}
              disabled={loading}
              title="Refresh workspace"
              aria-label="Refresh workspace"
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
            <span className="user-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        <div className="page-content">
          {['suspended', 'revoked'].includes(data.company.registry.licence_status) && (
            <div className="licence-pause-notice">
              <ShieldCheck size={19} />
              <span>
                <b>Company submissions are paused.</b> Your CarbonX licence is{' '}
                {data.company.registry.licence_status}. Existing evidence is available to read.
              </span>
              <a href="#submissions">View details</a>
            </div>
          )}
          {user.isExample && (
            <div className="example-banner">
              <Leaf size={16} />
              <span>
                <b>Example workspace</b> · Demo company records are synthetic. Published references
                are labelled separately.
              </span>
              <button className="demo-role-switch" onClick={() => void switchDemo()}>
                View this company as government
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <SectionTabs
            pages={section.pages.filter((p) => p[0] !== 'audit' || user.role !== 'analyst')}
            view={view}
          />
          <Suspense fallback={<Spinner />}>{pages[view] || pages.overview}</Suspense>
        </div>
        <footer className="app-footer">
          <span>
            CARBONX <b>·</b> SUSTAINABILITY INTELLIGENCE
          </span>
          <span>Trace the evidence. Record the judgment.</span>
        </footer>
      </main>
      {claimId && (
        <Suspense fallback={<Spinner />}>
          <ClaimDetail key={claimId} />
        </Suspense>
      )}
    </div>
  );
}
export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}

import './monitoring.css';

import './presentation.css';
