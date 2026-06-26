export const APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  KYC_FAILED: 'KYC_FAILED',
  DISBURSED: 'DISBURSED',
  CANCELLED: 'CANCELLED',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

/** `application.kyc_status` (SmallInt). */
export const APPLICATION_KYC_STATUS = {
  NOT_DONE: 0,
  COMPLETED: 1,
  FAILED: 2,
  TECHNICAL_ISSUE: 3,
} as const;

/** IFSC: 4 bank letters + 0 + 6 branch alphanumeric (11 chars). Example: HDFC0001234 */
export const IFSC_CODE_LENGTH = 11;

export const IFSC_CODE_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const IFSC_CODE_PATTERN = `${IFSC_CODE_REGEX.source}`;
