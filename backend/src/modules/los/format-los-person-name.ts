/** Uppercase borrower / reference names in LOS API responses. */
export function formatLosPersonName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}
