/** 6-digit Indian pincode */
export const PINCODE_REGEX = /^\d{6}$/;

/** Basic email format check */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PAN card format: 5 letters, 4 digits, 1 letter — uppercase */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

export function isValidPincode(value: string): boolean {
  return PINCODE_REGEX.test(value);
}

export function isValidPan(value: string): boolean {
  return PAN_REGEX.test(value.toUpperCase());
}
