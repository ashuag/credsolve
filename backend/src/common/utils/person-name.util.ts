/** Collapse spaces, strip combining marks, compare case-insensitively (for PAN / KYC name matching). */
export function normalizeComparablePersonName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * CIBIL inquiry requires a last name. When the customer has only a first name
 * (e.g. `KRISHNALAL`), send it as both first and last: `KRISHNALAL KRISHNALAL`.
 * Stored profile names are left unchanged — this is only for the bureau request.
 */
export function formatBureauInquiryName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `${parts[0]} ${parts[0]}`;
  return parts.join(' ');
}

/** Letters (any script), spaces, and periods only; no digits or other symbols. */
export const PERSON_NAME_PATTERN = /^[\p{L}]+(?:[ .][\p{L}]+)*$/u;

export const PERSON_NAME_VALIDATION_MESSAGE =
  'Name may only contain letters, spaces, and periods.';
