export type Portal = 'company' | 'government';
const pages: Record<Portal, string[]> = {
  company: [
    'overview',
    'reports',
    'claims',
    'evidence',
    'history',
    'monitoring',
    'environment',
    'submissions',
    'recommendations',
    'evaluations',
    'audit',
    'settings',
  ],
  government: [
    'government',
    'gov-registry',
    'gov-submissions',
    'gov-monitoring',
    'gov-actions',
    'gov-users',
    'gov-audit',
  ],
};
export function rememberDestination(portal: Portal, page: string) {
  if (!pages[portal].includes(page)) return;
  try {
    sessionStorage.setItem('carbonx_destination', JSON.stringify({ portal, page }));
  } catch {}
}
export function takeDestination(portal: Portal) {
  let preferred: unknown;
  try {
    const stored = JSON.parse(sessionStorage.getItem('carbonx_destination') || 'null');
    sessionStorage.removeItem('carbonx_destination');
    if (stored?.portal === portal) preferred = stored.page;
  } catch {}
  const current = location.hash.slice(1),
    chosen = typeof preferred === 'string' ? preferred : current;
  return pages[portal].includes(chosen)
    ? chosen
    : portal === 'government'
      ? 'government'
      : 'overview';
}
