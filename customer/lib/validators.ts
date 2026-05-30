/** 6-digit Indian pincode */
export const PINCODE_REGEX = /^\d{6}$/;

/** Basic email format check */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PAN card format: 5 letters, 4 digits, 1 letter — uppercase */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Letters (any script), spaces, and periods only; no digits or other symbols. */
export const PERSON_NAME_REGEX = /^[\p{L}]+(?:[ .][\p{L}]+)*$/u;

export const PERSON_NAME_VALIDATION_MESSAGE =
  'Name may only contain letters, spaces, and periods.';

export function sanitizePersonNameInput(value: string): string {
  return value.replace(/[^\p{L} .]/gu, '');
}

export function isValidPersonName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && PERSON_NAME_REGEX.test(trimmed);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPincode(value: string): boolean {
  return PINCODE_REGEX.test(value);
}

export function isValidPan(value: string): boolean {
  return PAN_REGEX.test(value.toUpperCase());
}

/**
 * Checks that:
 *  - 4th character is 'P' (individual PAN)
 *  - 5th character matches the first letter of the last word in the full name
 *    (single name → first letter of that name)
 */
export function isPanNameMatch(pan: string, fullName: string): boolean {
  const p = pan.trim().toUpperCase();
  if (p.length < 5) return false;

  if (p[3] !== 'P') return false;

  const nameParts = fullName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return false;

  const lastNameFirstChar = nameParts[nameParts.length - 1]![0]!;
  return p[4] === lastNameFirstChar;
}
