/** Display applicant / reference names in uppercase across LOS workspaces. */
export function formatPersonName(name: string | null | undefined, fallback = '—'): string {
  const trimmed = name?.trim();
  if (!trimmed) return fallback;
  return trimmed.toUpperCase();
}
