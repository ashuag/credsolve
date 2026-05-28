export const APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  /** Aadhaar / identity verification failed (name or DOB mismatch with profile). */
  KYC_FAILED: 'KYC_FAILED',
  DISBURSED: 'DISBURSED',
} as const;

export type ApplicationStatus = (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

/** `application.kyc_status` (SmallInt). */
export const APPLICATION_KYC_STATUS = {
  NOT_DONE: 0,
  COMPLETED: 1,
  FAILED: 2,
  TECHNICAL_ISSUE: 3,
} as const;
