/** LOS API bases — set in `.env` / deployment env only (no code fallbacks). */

/**
 * LOS routes are mounted at Nest `/api/los/...`.
 * Accept either `.../api/los` or the common mistake `.../api` so callers resolve to `/api/los/auth/login`, not `/api/auth/login`.
 */
export function normalizeLosApiBase(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  // Common misconfigurations
  u = u.replace(/\/api\/backend$/i, '/api/los');
  u = u.replace(/\/api\/los\/los$/i, '/api/los');
  if (u.endsWith('/api/los')) {
    return u;
  }
  if (u.endsWith('/api')) {
    return `${u}/los`;
  }
  return u;
}

/**
 * Join a LOS API base (`.../api/los`) with a route (`/bre/...` or `/developer-tools/...`).
 * Drops a redundant `/los` prefix on `path` so callers do not produce `/api/los/los/...`.
 */
export function buildLosApiUrl(base: string, path: string): string {
  const normalizedBase = normalizeLosApiBase(base);
  let route = path.startsWith('/') ? path : `/${path}`;
  if (normalizedBase.endsWith('/api/los') && route.startsWith('/los/')) {
    route = route.slice(4);
  }
  return `${normalizedBase}${route}`;
}

export function getLosServerApiBase(): string {
  const u = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL.');
  }
  return normalizeLosApiBase(u);
}

function ensureHttpsForSecurePage(base: string): string {
  if (typeof window === 'undefined') {
    return base;
  }
  if (window.location.protocol === 'https:' && base.startsWith('http://')) {
    return `https://${base.slice('http://'.length)}`;
  }
  return base;
}

export function getLosClientApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing NEXT_PUBLIC_API_URL.');
  }
  return ensureHttpsForSecurePage(normalizeLosApiBase(u));
}
