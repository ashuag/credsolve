import { randomBytes } from 'node:crypto';

/**
 * Public journey reference, allocated once at lead creation and reused as
 * `application.application_number` and `loan_account.loan_number`.
 *
 * Format (exactly 12 alphanumeric chars, no hyphens):
 *   APP + YYYY + 5 chars from [A-HJ-NP-Z2-9] (excludes I/O/0/1)
 *
 * Example: `APP2026K7M2Q`
 */
export const APPLICATION_NUMBER_PREFIX = 'APP';
export const APPLICATION_NUMBER_SUFFIX_LENGTH = 5;
/** Exact length of every application number (APP + YYYY + suffix). */
export const APPLICATION_NUMBER_LENGTH = 12;
export const APPLICATION_NUMBER_MAX_LENGTH = APPLICATION_NUMBER_LENGTH;

const SUFFIX_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const APPLICATION_NUMBER_PATTERN = new RegExp(
  `^${APPLICATION_NUMBER_PREFIX}\\d{4}[A-HJ-NP-Z2-9]{${APPLICATION_NUMBER_SUFFIX_LENGTH}}$`,
);

function randomSuffix(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SUFFIX_ALPHABET[bytes[i]! % SUFFIX_ALPHABET.length]!;
  }
  return out;
}

/** Generates a new 12-character journey ID for the given calendar year (UTC). */
export function generateApplicationNumber(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const value = `${APPLICATION_NUMBER_PREFIX}${year}${randomSuffix(APPLICATION_NUMBER_SUFFIX_LENGTH)}`;
  if (value.length !== APPLICATION_NUMBER_LENGTH) {
    throw new Error(
      `generateApplicationNumber produced length ${value.length}, expected ${APPLICATION_NUMBER_LENGTH}`,
    );
  }
  return value;
}

/** Same generator as {@link generateApplicationNumber}; allocated on `lead.lead_id`. */
export function generateLeadNumber(now: Date = new Date()): string {
  return generateApplicationNumber(now);
}

/** True when the value is a public journey ID (`APP` + year + 5 chars). */
export function isApplicationNumber(value: string): boolean {
  return APPLICATION_NUMBER_PATTERN.test(value.trim().toUpperCase());
}

/**
 * Loan account number used when creating `loan_account` at disbursement.
 * Intentionally identical to the application number so the public ID carries through.
 */
export function loanAccountNumberForApplication(applicationNumber: string): string {
  const value = applicationNumber.trim().toUpperCase();
  if (!value) {
    throw new Error('applicationNumber is required to derive loanAccountNumber');
  }
  if (value.length !== APPLICATION_NUMBER_LENGTH) {
    throw new Error(
      `applicationNumber must be exactly ${APPLICATION_NUMBER_LENGTH} characters`,
    );
  }
  return value;
}

/** Stable backfill shape for existing rows (unique by numeric id). */
export function applicationNumberFromLegacyId(id: bigint | number, createdAt: Date): string {
  const year = createdAt.getUTCFullYear();
  const base36 = BigInt(id).toString(36).toUpperCase().padStart(APPLICATION_NUMBER_SUFFIX_LENGTH, '0');
  const suffix = base36.slice(-APPLICATION_NUMBER_SUFFIX_LENGTH);
  return `${APPLICATION_NUMBER_PREFIX}${year}${suffix}`;
}
