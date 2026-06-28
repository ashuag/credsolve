/** 6-digit Indian pincode */
export const PINCODE_REGEX = /^\d{6}$/;

/** Minimum annual turnover for self-employed applicants (INR). */
export const MIN_ANNUAL_TURNOVER = 120_000;

/** Minimum annual profit for self-employed applicants (INR). */
export const MIN_ANNUAL_PROFIT = 10_000;

const ADDRESS_ALLOWED_PATTERN = /^[\p{L}\p{N} .,#\-/]+$/u;

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

export function isValidAddressLine1(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5) return false;
  if (!ADDRESS_ALLOWED_PATTERN.test(trimmed)) return false;
  return /\d/.test(trimmed) || trimmed.length >= 10;
}

export const ADDRESS_LINE1_VALIDATION_MESSAGE =
  'Enter a complete address (at least 10 characters or include a house/flat number).';