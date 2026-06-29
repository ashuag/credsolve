export const LEAD_STATUS = {
  NEW: 'NEW',
  /** Lead is being worked (email verified, profile / details in progress). */
  IN_PROGRESS: 'IN_PROGRESS',
  /** Lead handed off; application owns the rest of the journey. */
  CONVERTED: 'CONVERTED',
  REJECTED: 'REJECTED',
  /** Too many consecutive rejections — locked out for BLACKLIST_DURATION_DAYS. */
  BLACKLISTED: 'BLACKLISTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];
