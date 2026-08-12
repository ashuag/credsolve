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

/** Server-side Nest base for proxying same-origin `/api/los/*` (must be absolute). */
export function getLosServerApiBase(): string {
  const u = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL.');
  }
  const base = normalizeLosApiBase(u);
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      'LOS API proxy needs an absolute API URL. Set API_SERVER_URL=http://127.0.0.1:4001/api/los ' +
        '(host dev) or API_SERVER_URL=http://backend:4001/api/los (Docker). ' +
        'Using only NEXT_PUBLIC_API_URL=/api/los breaks proxying and causes 502s on /api/los/*.',
    );
  }
  return base;
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

/** Browser base — prefer same-origin `/api/los` (Next proxies to Nest). */
export function getLosClientApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing NEXT_PUBLIC_API_URL.');
  }

  const raw = u.trim();

  /**
   * Stale local env often points the browser at Nest `:4001`, which hits CORS and
   * Firefox NS_ERROR_NET_RESET when HTTPS is used against plain HTTP. Same-origin
   * `/api/los` is proxied by `app/api/los/[[...path]]`.
   */
  if (/^https?:\/\/(?:127\.0\.0\.1|localhost):4001\b/i.test(raw)) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(
        '[MoneyCash LOS] NEXT_PUBLIC_API_URL points at port 4001 in the browser; using same-origin `/api/los` instead. ' +
          'Set NEXT_PUBLIC_API_URL=/api/los in los/.env and restart `next dev`.',
      );
    }
    return '/api/los';
  }

  return ensureHttpsForSecurePage(normalizeLosApiBase(raw));
}
