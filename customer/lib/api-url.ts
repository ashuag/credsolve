/**
 * Nest uses global prefix `/api`. If `NEXT_PUBLIC_API_URL` is an absolute origin without that
 * prefix (e.g. `http://localhost:4001`), requests hit `/leads/...` on the host and Nest returns 404
 * for the real path `/api/leads/...`.
 */
function ensureNestGlobalPrefix(url: string): string {
  const s = url.trim();
  if (!/^https?:\/\//i.test(s)) {
    return s.replace(/\/$/, '') || s;
  }
  try {
    const u = new URL(s);
    const pathOnly = (u.pathname.replace(/\/$/, '') || '/') as string;
    if (pathOnly === '/') {
      return `${u.origin}/api`;
    }
    return s.replace(/\/$/, '');
  } catch {
    return s.replace(/\/$/, '');
  }
}

export function getApiUrl() {
  if (typeof window === 'undefined') {
    const apiUrl = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL in customer environment.');
    }

    return ensureNestGlobalPrefix(apiUrl);
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
        '[MoneyCash] NEXT_PUBLIC_API_URL points at port 4001 in the browser; using same-origin `/api` instead. ' +
          'Set NEXT_PUBLIC_API_URL=/api in customer/.env, restart `next dev`, and run `rm -rf .next` if requests still hit :4001.'
      );
    }
    return '/api';
  }

  return ensureNestGlobalPrefix(rawPublic);
}
