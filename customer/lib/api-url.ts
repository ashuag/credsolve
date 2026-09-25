import { ensureNestApiBase } from './nest-api-base';

export function getApiUrl() {
  if (typeof window === 'undefined') {
    const apiUrl = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL in customer environment.');
    }

    return ensureNestApiBase(apiUrl);
  }

  const rawPublic = (process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  if (!rawPublic) {
    throw new Error('Missing NEXT_PUBLIC_API_URL in customer environment.');
  }

  /**
   * `NEXT_PUBLIC_*` is inlined when the client bundle is built. Mis-set or stale values often use
   * `http(s)://localhost:4001/...`, which breaks in Firefox (NS_ERROR_NET_RESET when HTTPS is used
   * against a plain HTTP Nest dev server) and triggers CORS. Next rewrites same-origin `/api/*`.
   */
  if (/^https?:\/\/(?:127\.0\.0\.1|localhost):4001\b/i.test(rawPublic)) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.warn(
        '[CredSolve] NEXT_PUBLIC_API_URL points at port 4001 in the browser; using same-origin `/api` instead. ' +
          'Set NEXT_PUBLIC_API_URL=/api in customer/.env, restart `next dev`, and run `rm -rf .next` if requests still hit :4001.'
      );
    }
    return '/api';
  }

  return ensureNestApiBase(rawPublic);
}

/**
 * Full-page URL to start Google OAuth (Nest `GET .../auth/google/login`).
 * When `NEXT_PUBLIC_API_URL` is absolute (e.g. `https://api.moneycash.in/api`), the browser must open
 * that host so the HttpOnly session cookie set by `api` is sent. Using only `/auth/google/login` on
 * `www` forwards cookies sent to `www`, which breaks split-host setups without `Domain=` cookies.
 */
export function buildGoogleOAuthStartHref(queryString: string): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  const suffix = queryString.length > 0 ? `?${queryString}` : '';

  if (!raw || raw.startsWith('/')) {
    return `/auth/google/login${suffix}`;
  }

  const apiBase = ensureNestApiBase(raw);
  if (!/^https?:\/\//i.test(apiBase)) {
    return `/auth/google/login${suffix}`;
  }

  const noTrailing = apiBase.replace(/\/$/, '');
  return `${noTrailing}/auth/google/login${suffix}`;
}
