let csrf = '';
export function setCSRF(token: string) {
  csrf = token;
}
export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD'].includes(options.method))
    headers.set('X-CSRF-Token', csrf);
  const res = await fetch('/api' + url, { ...options, headers, credentials: 'same-origin' });
  const data = await res
    .json()
    .catch(() => ({ error: 'The server returned an unreadable response.' }));
  if (!res.ok)
    throw new Error(
      (data.error || 'Request failed.') +
        (data.fields
          ? ' ' + data.fields.map((f: any) => f.field + ': ' + f.message).join('; ')
          : ''),
    );
  return data;
}
export const mutate = <T = any>(url: string, body: any = {}, method = 'POST') =>
  api<T>(url, { method, body: JSON.stringify(body) });
export type Item = Record<string, any>;
export type User = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'analyst' | 'reviewer';
  portal: 'company' | 'government';
  company: string;
  companyId: string;
  isExample: boolean;
};
export const label = (s: string) =>
  s?.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Not recorded';
export const date = (s: string) =>
  new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const number = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
