/**
 * ISO date-only `YYYY-MM-DD` (as returned by the API) → `DD/MM/YYYY` for India-facing labels.
 */
export function formatIsoDateDdMmYyyy(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}
