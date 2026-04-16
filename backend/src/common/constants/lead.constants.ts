export const LEAD_STATUS = {
    NEW: 'NEW',
    EMAIL_VERIFIED: 'EMAIL_VERIFIED',
    DETAIL_STARTED: 'DETAIL_STARTED',
    CONVERTED: 'CONVERTED',
} as const;

export type LeadStatus = typeof LEAD_STATUS[keyof typeof LEAD_STATUS];
