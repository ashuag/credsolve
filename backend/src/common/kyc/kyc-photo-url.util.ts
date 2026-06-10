/** Append a cache-buster query param so replaced JPEGs at a fixed storage key are not served stale from CDN/browser. */
export function appendPhotoCacheBuster(url: string, version: string | number): string {
  const v = String(version).trim();
  if (!v) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('v', v);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(v)}`;
  }
}
