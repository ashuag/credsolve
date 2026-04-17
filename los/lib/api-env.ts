/** LOS API bases — set in `.env` / deployment env only (no code fallbacks). */

export function getLosServerApiBase(): string {
  const u = process.env.API_SERVER_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing API_SERVER_URL or NEXT_PUBLIC_API_URL.');
  }
  return u.trim().replace(/\/$/, '');
}

export function getLosClientApiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL;
  if (!u?.trim()) {
    throw new Error('Missing NEXT_PUBLIC_API_URL.');
  }
  return u.trim().replace(/\/$/, '');
}
