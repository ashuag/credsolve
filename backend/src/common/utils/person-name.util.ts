/** Collapse spaces, strip combining marks, compare case-insensitively (for PAN / KYC name matching). */
export function normalizeComparablePersonName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Letters (any script), spaces, and periods only; no digits or other symbols. */
export const PERSON_NAME_PATTERN = /^[\p{L}]+(?:[ .][\p{L}]+)*$/u;

export const PERSON_NAME_VALIDATION_MESSAGE =
  'Name may only contain letters, spaces, and periods.';
