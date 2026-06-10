/** IFSC: 4 bank letters + 0 + 6 branch alphanumeric (11 chars). Example: HDFC0001234 */
export const IFSC_CODE_LENGTH = 11;

export const IFSC_CODE_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfscInput(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, IFSC_CODE_LENGTH);
}

export function isValidIfscCode(code: string): boolean {
  return IFSC_CODE_REGEX.test(code.trim().toUpperCase());
}

/** Returns a user-facing validation message, or null when input is empty or still being typed. */
export function getIfscValidationError(code: string, options?: { touched?: boolean }): string | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized.length < IFSC_CODE_LENGTH) {
    return options?.touched ? `IFSC must be exactly ${IFSC_CODE_LENGTH} characters.` : null;
  }

  if (!IFSC_CODE_REGEX.test(normalized)) {
    return `Invalid IFSC Code`;
  }

  return null;
}
