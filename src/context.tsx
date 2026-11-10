import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { api, mutate, setCSRF, type User, type Item } from './api';
type Workspace = {
  user: User | null;
  ready: boolean;
  loading: boolean;
  data: Item;
  toast: (s: string) => void;
  refresh: () => Promise<void>;
  signIn: (x: any) => void;
  logout: () => void;
  openClaim: (id: string) => void;
  claimId: string | null;
  closeClaim: () => void;
};
const Context = createContext<Workspace>(null!);
const blank = {
  dashboard: { stats: {}, coverage: [], observations: [], recentReports: [], recentActivity: [] },
  government: { companies: [], actions: [], submissions: [], users: [], audit: [], stats: {} },
  company: { registry: { licence_status: 'pending' }, submissions: [], actions: [], readings: [] },
  monitoring: {
    cities: [],
    rules: [],
    alerts: [],
    notifications: [],
    watch: [],
    facilities: [],
    ai: {},
    notificationChannels: {},
  },
  reports: [],
  claims: [],
  facilities: [],
  history: [],
  jobs: [],
  recommendations: [],
  environment: [],
  evaluations: { cases: [], runs: [] },
  settings: { providers: {} },
  audit: [],
  team: [],
};
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [data, setData] = useState<Item>(blank),
    [message, setMessage] = useState(''),
    [claimId, setClaimId] = useState<string | null>(null);
  const generation = useRef(0);
  const refreshing = useRef<number | null>(null);
  useEffect(() => {
    api('/auth/me')
      .then((x) => {
        setCSRF(x.csrf);
        setUser(x.user);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const toast = useCallback((s: string) => setMessage(s), []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 5500);
    return () => clearTimeout(t);
  }, [message]);
  const refresh = useCallback(async () => {
    if (!user || refreshing.current === generation.current) return;
    setLoading(true);
    const requestGeneration = generation.current;
    refreshing.current = requestGeneration;
    try {
      if (user.portal === 'government') {
        const [government, monitoring] = await Promise.all([
          api('/government/overview'),
          api('/monitoring'),
        ]);
        if (requestGeneration === generation.current)
          setData({ ...blank, government, monitoring, refreshedAt: new Date().toISOString() });
        return;
      }
      const keys = [
        'dashboard',
        'reports',
        'claims',
        'facilities',
        'history',
        'jobs',
        'recommendations',
        'environment',
        'evaluations',
        'settings',
        'monitoring',
        'company/overview',
      ];
      if (user.role !== 'analyst') keys.push('audit');
      if (user.role === 'owner') keys.push('team');
      const results = await Promise.allSettled(keys.map((k) => api('/' + k)));
      const succeeded = keys.flatMap((key, i) =>
        results[i].status === 'fulfilled'
          ? [
              [
                key === 'company/overview' ? 'company' : key,
                (results[i] as PromiseFulfilledResult<any>).value,
              ],
            ]
          : [],
      );
      if (results.some((r) => r.status === 'rejected'))
        toast('Some records could not refresh. Previously loaded values are retained.');
      if (requestGeneration === generation.current)
        setData((previous) => ({
          ...previous,
          refreshedAt: new Date().toISOString(),
          ...Object.fromEntries(succeeded),
        }));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      if (requestGeneration === generation.current) setLoading(false);
      if (refreshing.current === requestGeneration) refreshing.current = null;
    }
  }, [user, toast]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!data.jobs.some((j: Item) => ['queued', 'running'].includes(j.status))) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const jobs = await api('/jobs');
        if (cancelled) return;
        if (jobs.some((j: Item) => ['queued', 'running'].includes(j.status)))
          setData((previous) => ({ ...previous, jobs }));
        else await refresh();
      } catch (e) {
        if (!cancelled) toast((e as Error).message);
      }
    }, 2200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [data.jobs, refresh, toast]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [user, refresh]);
  const signIn = (x: any) => {
    generation.current++;
    setCSRF(x.csrf);
    setData(blank);
    setClaimId(null);
    setUser(x.user);
    setReady(true);
  };
  const logout = async () => {
    try {
      await mutate('/auth/logout');
      generation.current++;
      setCSRF('');
      location.hash = user?.portal === 'government' ? 'government-login' : 'company-login';
      setUser(null);
      setData(blank);
      setClaimId(null);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <Context.Provider
      value={{
        user,
        ready,
        loading,
        data,
        toast,
        refresh,
        signIn,
        logout,
        openClaim: setClaimId,
        claimId,
        closeClaim: () => setClaimId(null),
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage('')} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
