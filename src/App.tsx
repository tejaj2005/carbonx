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
import { Brand, Spinner } from './components';
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
const navigation = [
  ['overview', 'Overview', LayoutDashboard],
  ['reports', 'Report library', FileText],
  ['claims', 'Claims & SDGs', ScanSearch],
  ['evidence', 'Evidence explorer', BookOpen],
  ['history', 'Historical data', Database],
  ['environment', 'Environment', Earth],
  ['recommendations', 'Action plans', ClipboardCheck],
  ['evaluations', 'Evaluation', FlaskConical],
  ['audit', 'Activity log', Activity],
  ['settings', 'Settings', Settings],
] as const;
function Auth() {
  const { signIn, toast } = useWorkspace();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      signIn(await mutate('/auth/' + (register ? 'register' : 'login'), values));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function example() {
    setBusy(true);
    try {
      signIn(await mutate('/auth/demo'));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Brand />
        <span className="auth-kicker">SUSTAINABILITY, WITH A SOURCE</span>
        <h1>
          Every claim deserves
          <br />
          <em>an evidence trail.</em>
        </h1>
        <p>
          Turn organisational reports into cited claims, SDG mappings and explainable reviews.
          Follow the evidence from the first passage to the final decision.
        </p>
        <div className="auth-visual">
          <div className="orbit">
            <Leaf size={40} />
          </div>
          <div className="evidence-node n1">
            01 <b>Report</b>
            <small>Ingest & structure</small>
          </div>
          <div className="evidence-node n2">
            02 <b>Evidence</b>
            <small>Retrieve & compare</small>
          </div>
          <div className="evidence-node n3">
            03 <b>Review</b>
            <small>Explain & decide</small>
          </div>
        </div>
        <div className="auth-foot">
          <ShieldCheck size={17} /> Company workspaces · Source citations · Human review
        </div>
      </div>
      <div className="auth-form-area">
        <div className="auth-card">
          <span className="eyebrow">CARBONX WORKSPACE</span>
          <h2>{register ? 'Create your workspace' : 'Welcome back'}</h2>
          <p>
            {register
              ? 'Start an evidence-led sustainability review.'
              : 'Sign in to continue reviewing your reports.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <>
                <label>
                  Your name
                  <input name="name" required minLength={2} autoComplete="name" />
                </label>
                <label>
                  Company or organisation
                  <input name="company" required minLength={2} autoComplete="organization" />
                </label>
              </>
            )}
            <label>
              Email address
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
              />
              {register && <small>Use at least 12 characters.</small>}
            </label>
            <button className="button primary" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create workspace' : 'Sign in'}
              <ArrowRight size={16} />
            </button>
          </form>
          <button className="auth-switch" onClick={() => setRegister(!register)}>
            {register ? 'Already have an account? Sign in' : 'New here? Create a company workspace'}
          </button>
          <div className="auth-divider">
            <span>OR EXPLORE</span>
          </div>
          <button className="button secondary full" disabled={busy} onClick={example}>
            Open an example workspace
            <ArrowRight size={16} />
          </button>
          <p className="fine-print">
            The example workspace contains synthetic reports and history. Your company starts with
            an empty library.
          </p>
        </div>
      </div>
    </div>
  );
}
function Shell() {
  const { user, ready, loading, data, refresh, logout, claimId } = useWorkspace();
  const [view, setView] = useState(location.hash.slice(1) || 'overview'),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const change = () => {
      setView(location.hash.slice(1) || 'overview');
      setMenu(false);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  if (!ready) return <Spinner />;
  if (!user) return <Auth />;
  const pages: Record<string, React.ReactNode> = {
    overview: <Dashboard />,
    reports: <Reports />,
    claims: <Claims />,
    evidence: <Evidence />,
    history: <History />,
    environment: <Environment />,
    recommendations: <Recommendations />,
    evaluations: <Evaluation />,
    audit: <Audit />,
    settings: <SettingsPage />,
  };
  const current = navigation.find((n) => n[0] === view)?.[1] || 'Overview';
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
          {navigation
            .filter((n) => n[0] !== 'audit' || user.role !== 'analyst')
            .map(([id, name, Icon]) => (
              <a href={'#' + id} className={view === id ? 'active' : ''} key={id}>
                <Icon size={18} />
                {name}
                {id === 'claims' && data.dashboard.stats.needsReview > 0 && (
                  <b>{data.dashboard.stats.needsReview}</b>
                )}
              </a>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-health">
            <span />
            <strong>
              {data.settings.providers.hostedAI?.configured
                ? 'Hosted AI configured'
                : 'Keyword baseline active'}
            </strong>
            <small>
              {data.settings.providers.hostedAI?.configured
                ? 'Evidence remains traceable'
                : 'Configure hosted AI in server settings'}
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
          {user.isExample && (
            <div className="example-banner">
              <Leaf size={16} />
              <span>
                <b>Example workspace</b> · All source reports, organisations and historical values
                here are synthetic.
              </span>
            </div>
          )}
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
