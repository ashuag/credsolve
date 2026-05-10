/** Collapse spaces, strip combining marks, compare case-insensitively (for PAN / KYC name matching). */
export function normalizeComparablePersonName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
