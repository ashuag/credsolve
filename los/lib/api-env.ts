/** LOS API bases — set in `.env` / deployment env only (no code fallbacks). */

/**
 * LOS routes are mounted at Nest `/api/los/...`.
 * Accept either `.../api/los` or the common mistake `.../api` so callers resolve to `/api/los/auth/login`, not `/api/auth/login`.
 */
export function normalizeLosApiBase(raw: string): string {
  const u = raw.trim().replace(/\/$/, '');
  if (u.endsWith('/api/los')) {
    return u;
  }
  if (u.endsWith('/api')) {
    return `${u}/los`;
  }
  return u;
}

export function getLosServerApiBase(): string {
  const u = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL.');
  }
  return normalizeLosApiBase(u);
}

export function getLosClientApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing NEXT_PUBLIC_API_URL.');
  }
  return normalizeLosApiBase(u);
}
