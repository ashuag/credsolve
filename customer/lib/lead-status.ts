/** Mirrors backend `LEAD_STATUS` for customer routes (keep in sync). */
export const CUSTOMER_LEAD_STATUS = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  CONVERTED: 'CONVERTED',
  REJECTED: 'REJECTED',
  /** Too many consecutive rejections — locked out for the blacklist window. */
  BLACKLISTED: 'BLACKLISTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
