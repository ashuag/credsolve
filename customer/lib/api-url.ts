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

  if (!process.env.NEXT_PUBLIC_API_URL) {
    throw new Error('Missing NEXT_PUBLIC_API_URL in customer environment.');
  }

  return ensureNestGlobalPrefix(process.env.NEXT_PUBLIC_API_URL);
}
