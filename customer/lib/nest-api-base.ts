/** Nest uses global prefix `/api`; tolerate `API_SERVER_URL` without that suffix. */
export function ensureNestApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    const pathOnly = (u.pathname.replace(/\/$/, '') || '/') as string;
    if (pathOnly === '/') {
      return `${u.origin}/api`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/** Server-side Nest base for proxying same-origin `/api/*` (must be absolute). */
export function getCustomerServerApiBase(): string {
  const raw = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!raw?.trim()) {
    throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL in customer environment.');
  }
  const base = ensureNestApiBase(raw);
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      'Customer API proxy needs an absolute API URL. Set API_SERVER_URL=http://localhost:4001/api ' +
        '(host dev) or API_SERVER_URL=http://backend:4001/api (Docker). ' +
        'Using only NEXT_PUBLIC_API_URL=/api breaks proxying and causes 500s on /api/*.'
    );
  }
  return base;
}
